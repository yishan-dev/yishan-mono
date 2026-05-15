package workspace

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type CreateRequest struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organizationId,omitempty"`
	ProjectID      string `json:"projectId,omitempty"`
	RepoKey        string `json:"repoKey"`
	WorkspaceName  string `json:"workspaceName"`
	SourcePath     string `json:"sourcePath"`
	TargetBranch   string `json:"targetBranch"`
	SourceBranch   string `json:"sourceBranch"`
	ContextEnabled bool   `json:"contextEnabled,omitempty"`
	SetupHook      string `json:"setupHook,omitempty"`
}

type CreateProgressStatus string

const (
	CreateProgressPending   CreateProgressStatus = "pending"
	CreateProgressRunning   CreateProgressStatus = "running"
	CreateProgressCompleted CreateProgressStatus = "completed"
	CreateProgressFailed    CreateProgressStatus = "failed"
	CreateProgressSkipped   CreateProgressStatus = "skipped"
	CreateProgressWarning   CreateProgressStatus = "warning"
)

type CreateProgressEvent struct {
	WorkspaceID string               `json:"workspaceId"`
	StepID      string               `json:"stepId"`
	Label       string               `json:"label"`
	Status      CreateProgressStatus `json:"status"`
	Message     string               `json:"message,omitempty"`
	CreatedAt   string               `json:"createdAt"`
}

type CreateProgressReporter func(CreateProgressEvent)

type createProgressStep struct {
	ID      string
	Label   string
	Timeout time.Duration
	Run     func(ctx context.Context) (CreateProgressStatus, string, error)
}

func (m *Manager) CreateWorkspace(ctx context.Context, req CreateRequest) (Workspace, error) {
	return m.CreateWorkspaceWithProgress(ctx, req, nil)
}

func (m *Manager) CreateWorkspaceWithProgress(ctx context.Context, req CreateRequest, report CreateProgressReporter) (Workspace, error) {
	reportProgress := func(stepID string, label string, status CreateProgressStatus, message string) {
		if report == nil {
			return
		}

		report(CreateProgressEvent{
			WorkspaceID: strings.TrimSpace(req.ID),
			StepID:      stepID,
			Label:       label,
			Status:      status,
			Message:     message,
			CreatedAt:   time.Now().UTC().Format(time.RFC3339Nano),
		})
	}

	for _, field := range []struct {
		name  string
		value string
	}{
		{name: "id", value: req.ID},
		{name: "sourcePath", value: req.SourcePath},
		{name: "repoKey", value: req.RepoKey},
		{name: "workspaceName", value: req.WorkspaceName},
		{name: "targetBranch", value: req.TargetBranch},
		{name: "sourceBranch", value: req.SourceBranch},
	} {
		if strings.TrimSpace(field.value) == "" {
			return Workspace{}, NewRPCError(-32602, field.name+" is required")
		}
	}

	sourcePath, err := absUserPath(req.SourcePath)
	if err != nil {
		return Workspace{}, err
	}
	repoKey, err := safeRelativePath(req.RepoKey, "repoKey")
	if err != nil {
		return Workspace{}, err
	}
	workspaceName, err := safeRelativePath(req.WorkspaceName, "workspaceName")
	if err != nil {
		return Workspace{}, err
	}
	worktreePath, err := defaultWorktreePath(repoKey, workspaceName)
	if err != nil {
		return Workspace{}, err
	}

	ws := Workspace{ID: strings.TrimSpace(req.ID), Path: worktreePath}
	steps := []createProgressStep{
		{
			ID:      "worktree",
			Label:   "Create local worktree",
			Timeout: 10 * time.Minute,
			Run: func(stepCtx context.Context) (CreateProgressStatus, string, error) {
				err := m.gits.CreateWorktree(stepCtx, sourcePath, req.TargetBranch, worktreePath, true, strings.TrimSpace(req.SourceBranch))
				if err == nil {
					return CreateProgressCompleted, worktreePath, nil
				}

				if !isMissingRefError(err) {
					return CreateProgressFailed, err.Error(), err
				}

				reportProgress("worktree", "Create local worktree", CreateProgressRunning, "Fetching missing refs...")
				if fetchErr := m.gits.FetchRef(stepCtx, sourcePath, strings.TrimSpace(req.SourceBranch)); fetchErr != nil {
					return CreateProgressFailed, fetchErr.Error(), fetchErr
				}

				if err := m.gits.CreateWorktree(stepCtx, sourcePath, req.TargetBranch, worktreePath, true, strings.TrimSpace(req.SourceBranch)); err != nil {
					return CreateProgressFailed, err.Error(), err
				}
				return CreateProgressCompleted, worktreePath, nil
			},
		},
		{
			ID:      "context",
			Label:   "Link project context",
			Timeout: 30 * time.Second,
			Run: func(stepCtx context.Context) (CreateProgressStatus, string, error) {
				if !req.ContextEnabled {
					return CreateProgressSkipped, "Context link disabled", nil
				}

				contextPath, err := defaultContextPath(repoKey)
				if err != nil {
					return CreateProgressFailed, err.Error(), err
				}
				if err := ensureContextLink(contextPath, worktreePath); err != nil {
					wrappedErr := fmt.Errorf("create context link: %w", err)
					return CreateProgressFailed, err.Error(), wrappedErr
				}
				return CreateProgressCompleted, "", nil
			},
		},
		{
			ID:      "setup",
			Label:   "Run setup script",
			Timeout: 5 * time.Minute,
			Run: func(stepCtx context.Context) (CreateProgressStatus, string, error) {
				hookResult, hookErr := RunHook(stepCtx, HookRequest{
					Command:       req.SetupHook,
					WorkspaceID:   ws.ID,
					WorkspacePath: ws.Path,
					HookName:      "setup",
				})
				if hookErr != nil {
					hookResult.Error = fmt.Sprintf("setup hook: %v", hookErr)
					ws.SetupHookResult = &hookResult
					return CreateProgressWarning, hookResult.Error, nil
				}
				if !hookResult.Skipped {
					ws.SetupHookResult = &hookResult
					if hookResult.Error != "" {
						return CreateProgressWarning, hookResult.Error, nil
					}
					return CreateProgressCompleted, "", nil
				}
				return CreateProgressSkipped, "No setup script configured", nil
			},
		},
	}

	for _, step := range steps {
		reportProgress(step.ID, step.Label, CreateProgressRunning, "")

		stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)
		status, message, err := step.Run(stepCtx)
		cancel()

		if err != nil {
			reportProgress(step.ID, step.Label, status, message)
			return Workspace{}, err
		}
		reportProgress(step.ID, step.Label, status, message)
	}

	m.mu.Lock()
	m.workspaces[ws.ID] = ws
	m.mu.Unlock()

	return ws, nil
}

func absUserPath(path string) (string, error) {
	if path == "~" || strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		if path == "~" {
			path = home
		} else {
			path = filepath.Join(home, path[2:])
		}
	}
	return filepath.Abs(path)
}

func defaultWorktreePath(repoKey string, workspaceName string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".yishan", "worktrees", repoKey, workspaceName), nil
}

func safeRelativePath(input string, field string) (string, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" || filepath.IsAbs(trimmed) {
		return "", NewRPCError(-32602, field+" must be relative")
	}
	cleaned := filepath.Clean(trimmed)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, ".."+string(filepath.Separator)) {
		return "", NewRPCError(-32602, field+" must not escape .yishan")
	}
	return cleaned, nil
}

func isMissingRefError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "not a valid object name") ||
		strings.Contains(msg, "unknown revision") ||
		strings.Contains(msg, "fatal: bad revision") ||
		strings.Contains(msg, "Invalid object name") ||
		strings.Contains(msg, "ambiguous argument")
}
