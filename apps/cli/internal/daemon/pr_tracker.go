package daemon

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/workspace"
)

const workspacePullRequestPollInterval = 5 * time.Minute

type workspacePRTracker struct {
	mu             sync.Mutex
	manager        *workspace.Manager
	active         map[string]bool
	inFlight       map[string]bool
	started        bool
	branchResolver func(context.Context, string) (string, error)
	prResolver     func(context.Context, string, string) (workspace.GitBranchPullRequestStatus, error)
}

func newWorkspacePRTracker(manager *workspace.Manager) *workspacePRTracker {
	tracker := &workspacePRTracker{
		manager:  manager,
		active:   make(map[string]bool),
		inFlight: make(map[string]bool),
	}
	tracker.branchResolver = func(ctx context.Context, root string) (string, error) {
		ws, ok := manager.FindWorkspaceByPath(root)
		if !ok {
			return "", workspace.NewRPCError(-32004, "workspace not found")
		}
		return manager.GitCurrentBranch(ctx, ws.ID)
	}
	tracker.prResolver = func(ctx context.Context, root string, branch string) (workspace.GitBranchPullRequestStatus, error) {
		ws, ok := manager.FindWorkspaceByPath(root)
		if !ok {
			return workspace.GitBranchPullRequestStatus{}, workspace.NewRPCError(-32004, "workspace not found")
		}
		return manager.GitBranchPullRequestLite(ctx, ws.ID, branch)
	}
	return tracker
}

func (t *workspacePRTracker) EnsureTracked(worktreePath string) {
	if strings.TrimSpace(worktreePath) == "" {
		return
	}

	t.mu.Lock()
	if !t.started {
		t.started = true
		go t.pollLoop()
	}
	t.mu.Unlock()

	go t.RefreshWorkspaceByPath(worktreePath)
}

func (t *workspacePRTracker) StopTracking(workspaceID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.active, workspaceID)
}

func (t *workspacePRTracker) RefreshWorkspaceByPath(worktreePath string) {
	ws, ok := t.manager.FindWorkspaceByPath(worktreePath)
	if !ok {
		log.Warn().Str("path", worktreePath).Msg("workspace PR refresh skipped because workspace path is not open")
		return
	}
	if !t.beginRefresh(ws.ID) {
		log.Debug().Str("workspaceId", ws.ID).Str("path", ws.Path).Msg("workspace PR refresh skipped because another refresh is already running")
		return
	}
	defer t.endRefresh(ws.ID)
	if err := t.refreshWorkspace(ws); err != nil {
		log.Debug().Err(err).Str("workspaceId", ws.ID).Str("path", ws.Path).Msg("failed to refresh workspace pull request state")
	}
}

func (t *workspacePRTracker) pollLoop() {
	ticker := time.NewTicker(workspacePullRequestPollInterval)
	defer ticker.Stop()

	for range ticker.C {
		for _, ws := range t.manager.List() {
			t.mu.Lock()
			tracked := t.active[ws.ID]
			t.mu.Unlock()
			if !tracked {
				continue
			}
			if !t.beginRefresh(ws.ID) {
				continue
			}

			if err := t.refreshWorkspace(ws); err != nil {
				log.Debug().Err(err).Str("workspaceId", ws.ID).Str("path", ws.Path).Msg("failed to poll workspace pull request state")
			}
			t.endRefresh(ws.ID)
		}
	}
}

func (t *workspacePRTracker) beginRefresh(workspaceID string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.inFlight[workspaceID] {
		return false
	}
	t.inFlight[workspaceID] = true
	return true
}

func (t *workspacePRTracker) endRefresh(workspaceID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.inFlight, workspaceID)
}

func (t *workspacePRTracker) refreshWorkspace(ws workspace.Workspace) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	branch, err := t.branchResolver(ctx, ws.Path)
	if err != nil {
		log.Warn().Err(err).Str("workspaceId", ws.ID).Str("path", ws.Path).Msg("workspace PR refresh failed to resolve branch")
		return err
	}
	branch = strings.TrimSpace(branch)
	log.Info().Str("workspaceId", ws.ID).Str("path", ws.Path).Str("branch", branch).Msg("workspace PR refresh resolved branch")
	if branch == "" || branch == "HEAD" {
		t.setWorkspacePullRequest(ws.ID, nil, false)
		log.Info().Str("workspaceId", ws.ID).Str("path", ws.Path).Msg("workspace PR refresh cleared PR because branch is empty or detached")
		return nil
	}

	pr, err := t.prResolver(ctx, ws.Path, branch)
	if err != nil {
		log.Warn().Err(err).Str("workspaceId", ws.ID).Str("path", ws.Path).Str("branch", branch).Msg("workspace PR refresh failed to resolve pull request")
		return err
	}
	if !pr.Found {
		t.setWorkspacePullRequest(ws.ID, nil, false)
		log.Info().Str("workspaceId", ws.ID).Str("path", ws.Path).Str("branch", branch).Msg("workspace PR refresh found no pull request")
		return nil
	}

	status := normalizeWorkspacePullRequestStatus(pr)
	bound := &workspace.WorkspacePullRequest{
		Number:         pr.Number,
		Title:          pr.Title,
		URL:            pr.URL,
		Branch:         pr.HeadRefName,
		BaseBranch:     pr.BaseRefName,
		GitHubState:    pr.State,
		Status:         status,
		ReviewDecision: pr.ReviewDecision,
		IsDraft:        pr.IsDraft,
		Complete:       status == "merged",
		UpdatedAt:      nowRFC3339Nano(),
		Checks:         pr.Checks,
		Deployments:    pr.Deployments,
	}
	complete := status == "merged"
	t.setWorkspacePullRequest(ws.ID, bound, !complete)
	log.Info().
		Str("workspaceId", ws.ID).
		Str("path", ws.Path).
		Str("branch", branch).
		Int("pullRequestNumber", pr.Number).
		Str("pullRequestStatus", status).
		Bool("complete", complete).
		Msg("workspace PR refresh synced pull request")
	return nil
}

func (t *workspacePRTracker) setWorkspacePullRequest(workspaceID string, pr *workspace.WorkspacePullRequest, keepActive bool) {
	if err := t.manager.SetWorkspacePullRequest(workspaceID, pr); err != nil {
		return
	}

	t.mu.Lock()
	defer t.mu.Unlock()
	if keepActive {
		t.active[workspaceID] = true
		return
	}
	delete(t.active, workspaceID)
}

func normalizeWorkspacePullRequestStatus(pr workspace.GitBranchPullRequestStatus) string {
	state := strings.ToUpper(strings.TrimSpace(pr.State))
	if state == "MERGED" || strings.TrimSpace(pr.MergedAt) != "" {
		return "merged"
	}
	if pr.IsDraft {
		return "draft"
	}
	if strings.EqualFold(strings.TrimSpace(pr.ReviewDecision), "REVIEW_REQUIRED") {
		return "review"
	}
	if state == "OPEN" {
		return "open"
	}
	if state == "CLOSED" {
		return "closed"
	}
	return strings.ToLower(state)
}
