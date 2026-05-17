package workspace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

const fetchTimeout = 15 * time.Second
const branchCacheTTL = 30 * time.Second
const branchPullRequestCacheTTL = 30 * time.Second

type GitStatusResponse struct {
	Branch string   `json:"branch"`
	Files  []string `json:"files"`
	Raw    string   `json:"raw"`
}

type GitChange struct {
	Path      string `json:"path"`
	Kind      string `json:"kind"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

type GitChangesBySection struct {
	Unstaged  []GitChange `json:"unstaged"`
	Staged    []GitChange `json:"staged"`
	Untracked []GitChange `json:"untracked"`
}

type GitBranchStatus struct {
	HasUpstream bool `json:"hasUpstream"`
	AheadCount  int  `json:"aheadCount"`
}

type GitBranchPullRequestStatus struct {
	Found          bool                       `json:"found"`
	Branch         string                     `json:"branch"`
	Number         int                        `json:"number,omitempty"`
	Title          string                     `json:"title,omitempty"`
	URL            string                     `json:"url,omitempty"`
	State          string                     `json:"state,omitempty"`
	ReviewDecision string                     `json:"reviewDecision,omitempty"`
	IsDraft        bool                       `json:"isDraft,omitempty"`
	MergedAt       string                     `json:"mergedAt,omitempty"`
	HeadRefName    string                     `json:"headRefName,omitempty"`
	BaseRefName    string                     `json:"baseRefName,omitempty"`
	Checks         []GitPullRequestCheck      `json:"checks,omitempty"`
	Deployments    []GitPullRequestDeployment `json:"deployments,omitempty"`
}

type GitPullRequestCheck struct {
	Name        string `json:"name"`
	Workflow    string `json:"workflow,omitempty"`
	State       string `json:"state"`
	Description string `json:"description,omitempty"`
	URL         string `json:"url,omitempty"`
}

type GitPullRequestDeployment struct {
	ID              int64  `json:"id"`
	Environment     string `json:"environment,omitempty"`
	State           string `json:"state,omitempty"`
	Description     string `json:"description,omitempty"`
	EnvironmentURL  string `json:"environmentUrl,omitempty"`
	CreatedAt       string `json:"createdAt,omitempty"`
	UpdatedAt       string `json:"updatedAt,omitempty"`
	OriginalPayload string `json:"originalPayload,omitempty"`
}

type GitCommit struct {
	Hash         string   `json:"hash"`
	ShortHash    string   `json:"shortHash"`
	AuthorName   string   `json:"authorName"`
	CommittedAt  string   `json:"committedAt"`
	Subject      string   `json:"subject"`
	ChangedFiles []string `json:"changedFiles"`
}

type GitCommitComparison struct {
	CurrentBranch   string      `json:"currentBranch"`
	TargetBranch    string      `json:"targetBranch"`
	AllChangedFiles []string    `json:"allChangedFiles"`
	Commits         []GitCommit `json:"commits"`
}

type GitBranchDiffSummary struct {
	FileCount int      `json:"fileCount"`
	Additions int      `json:"additions"`
	Deletions int      `json:"deletions"`
	Files     []string `json:"files"`
}

type GitDiffContent struct {
	OldContent string `json:"oldContent"`
	NewContent string `json:"newContent"`
}

type GitBranchList struct {
	CurrentBranch    string   `json:"currentBranch"`
	Branches         []string `json:"branches"`
	LocalBranches    []string `json:"localBranches,omitempty"`
	RemoteBranches   []string `json:"remoteBranches,omitempty"`
	WorktreeBranches []string `json:"worktreeBranches,omitempty"`
}

type GitInspectResult struct {
	IsGitRepository bool   `json:"isGitRepository"`
	RemoteURL       string `json:"remoteUrl,omitempty"`
	CurrentBranch   string `json:"currentBranch,omitempty"`
}

type branchCacheEntry struct {
	data GitBranchList
	at   time.Time
}

type branchPullRequestCacheEntry struct {
	data GitBranchPullRequestStatus
	at   time.Time
}

type GitService struct {
	mu                     sync.RWMutex
	branchCache            map[string]branchCacheEntry
	branchPullRequestCache map[string]branchPullRequestCacheEntry
}

func NewGitService() *GitService {
	return &GitService{
		branchCache:            make(map[string]branchCacheEntry),
		branchPullRequestCache: make(map[string]branchPullRequestCacheEntry),
	}
}

func (s *GitService) Status(ctx context.Context, root string) (GitStatusResponse, error) {
	out, err := gitCommand(ctx, root, "status", "--porcelain", "--branch")
	if err != nil {
		return GitStatusResponse{}, err
	}
	return parseStatusOutput(out), nil
}

func (s *GitService) Inspect(ctx context.Context, path string) (GitInspectResult, error) {
	candidatePath := strings.TrimSpace(path)
	if candidatePath == "" {
		return GitInspectResult{}, NewRPCError(-32602, "path is required")
	}

	absPath, err := filepath.Abs(candidatePath)
	if err != nil {
		return GitInspectResult{}, err
	}

	statInfo, err := os.Stat(absPath)
	if err == nil && !statInfo.IsDir() {
		absPath = filepath.Dir(absPath)
	}

	topLevel, err := gitCommand(ctx, absPath, "rev-parse", "--show-toplevel")
	if err != nil || strings.TrimSpace(topLevel) == "" {
		return GitInspectResult{IsGitRepository: false}, nil
	}

	repoRoot := strings.TrimSpace(topLevel)
	remoteURL, _ := gitCommand(ctx, repoRoot, "config", "--get", "remote.origin.url")
	currentBranch, _ := gitCommand(ctx, repoRoot, "rev-parse", "--abbrev-ref", "HEAD")

	return GitInspectResult{
		IsGitRepository: true,
		RemoteURL:       strings.TrimSpace(remoteURL),
		CurrentBranch:   strings.TrimSpace(currentBranch),
	}, nil
}

func (s *GitService) ListChanges(ctx context.Context, root string) (GitChangesBySection, error) {
	porcelain, err := gitCommand(ctx, root, "status", "--porcelain", "--untracked-files=all")
	if err != nil {
		return GitChangesBySection{}, err
	}
	unstagedNumstat, err := gitCommand(ctx, root, "diff", "--numstat")
	if err != nil {
		return GitChangesBySection{}, err
	}
	stagedNumstat, err := gitCommand(ctx, root, "diff", "--cached", "--numstat")
	if err != nil {
		return GitChangesBySection{}, err
	}

	unstagedStats := parseNumstat(unstagedNumstat)
	stagedStats := parseNumstat(stagedNumstat)

	sections := GitChangesBySection{
		Unstaged:  []GitChange{},
		Staged:    []GitChange{},
		Untracked: []GitChange{},
	}

	for line := range strings.SplitSeq(porcelain, "\n") {
		line = strings.TrimRight(line, "\r")
		if strings.TrimSpace(line) == "" || len(line) < 3 {
			continue
		}

		indexStatus := line[0]
		worktreeStatus := line[1]
		path := strings.TrimSpace(line[3:])
		path = normalizeStatusPath(path)
		if path == "" {
			continue
		}

		if indexStatus == '?' && worktreeStatus == '?' {
			sections.Untracked = append(sections.Untracked, GitChange{Path: path, Kind: "added"})
			continue
		}

		if indexStatus != ' ' && indexStatus != '?' {
			add, del := statValue(stagedStats[path])
			sections.Staged = append(sections.Staged, GitChange{Path: path, Kind: mapStatusToKind(indexStatus), Additions: add, Deletions: del})
		}
		if worktreeStatus != ' ' && worktreeStatus != '?' {
			add, del := statValue(unstagedStats[path])
			sections.Unstaged = append(sections.Unstaged, GitChange{Path: path, Kind: mapStatusToKind(worktreeStatus), Additions: add, Deletions: del})
		}
	}

	sections = reconcileUnstagedDeleteUntrackedAddPairs(sections)

	return sections, nil
}

func reconcileUnstagedDeleteUntrackedAddPairs(input GitChangesBySection) GitChangesBySection {
	deletedUnstaged := make([]GitChange, 0)
	addedUntracked := make([]GitChange, 0)
	for _, file := range input.Unstaged {
		if file.Kind == "deleted" {
			deletedUnstaged = append(deletedUnstaged, file)
		}
	}
	for _, file := range input.Untracked {
		if file.Kind == "added" {
			addedUntracked = append(addedUntracked, file)
		}
	}
	if len(deletedUnstaged) == 0 || len(addedUntracked) == 0 {
		return input
	}

	renamesByNewPath := map[string]GitChange{}
	consumedDeletedPaths := map[string]bool{}
	consumedAddedPaths := map[string]bool{}

	for _, deletedFile := range deletedUnstaged {
		deletedExt := fileExtension(deletedFile.Path)
		deletedParent := parentPath(deletedFile.Path)

		var sameDirectoryCandidate *GitChange
		for i := range addedUntracked {
			candidate := addedUntracked[i]
			if consumedAddedPaths[candidate.Path] {
				continue
			}
			if parentPath(candidate.Path) != deletedParent {
				continue
			}
			if deletedExt == "" || fileExtension(candidate.Path) == deletedExt {
				sameDirectoryCandidate = &candidate
				break
			}
		}

		fallbackCandidate := sameDirectoryCandidate
		if fallbackCandidate == nil {
			for i := range addedUntracked {
				candidate := addedUntracked[i]
				if consumedAddedPaths[candidate.Path] {
					continue
				}
				if deletedExt != "" && fileExtension(candidate.Path) == deletedExt {
					fallbackCandidate = &candidate
					break
				}
			}
		}

		if fallbackCandidate == nil {
			continue
		}

		consumedDeletedPaths[deletedFile.Path] = true
		consumedAddedPaths[fallbackCandidate.Path] = true

		existingRename, hasExisting := renamesByNewPath[fallbackCandidate.Path]
		if hasExisting {
			existingRename.Additions = maxInt(existingRename.Additions, fallbackCandidate.Additions)
			existingRename.Deletions = maxInt(existingRename.Deletions, fallbackCandidate.Deletions)
			renamesByNewPath[fallbackCandidate.Path] = existingRename
			continue
		}

		renamesByNewPath[fallbackCandidate.Path] = GitChange{
			Path:      fallbackCandidate.Path,
			Kind:      "renamed",
			Additions: maxInt(0, fallbackCandidate.Additions),
			Deletions: maxInt(0, fallbackCandidate.Deletions),
		}
	}

	if len(renamesByNewPath) == 0 {
		return input
	}

	nextUnstaged := make([]GitChange, 0, len(input.Unstaged)+len(renamesByNewPath))
	for _, file := range input.Unstaged {
		if consumedDeletedPaths[file.Path] {
			continue
		}
		nextUnstaged = append(nextUnstaged, file)
	}
	for _, renamed := range renamesByNewPath {
		nextUnstaged = append(nextUnstaged, renamed)
	}

	nextUntracked := make([]GitChange, 0, len(input.Untracked))
	for _, file := range input.Untracked {
		if consumedAddedPaths[file.Path] {
			continue
		}
		nextUntracked = append(nextUntracked, file)
	}

	input.Unstaged = nextUnstaged
	input.Untracked = nextUntracked
	return input
}

func parentPath(path string) string {
	normalizedPath := strings.ReplaceAll(path, "\\", "/")
	slashIndex := strings.LastIndex(normalizedPath, "/")
	if slashIndex <= 0 {
		return ""
	}
	return normalizedPath[:slashIndex]
}

func fileExtension(path string) string {
	fileName := path
	if slashIndex := strings.LastIndex(strings.ReplaceAll(path, "\\", "/"), "/"); slashIndex >= 0 {
		fileName = strings.ReplaceAll(path, "\\", "/")[slashIndex+1:]
	}
	dotIndex := strings.LastIndex(fileName, ".")
	if dotIndex <= 0 || dotIndex == len(fileName)-1 {
		return ""
	}
	return strings.ToLower(fileName[dotIndex+1:])
}

func maxInt(values ...int) int {
	if len(values) == 0 {
		return 0
	}
	maxValue := values[0]
	for _, value := range values[1:] {
		if value > maxValue {
			maxValue = value
		}
	}
	return maxValue
}

func (s *GitService) TrackChanges(ctx context.Context, root string, paths []string) error {
	if len(paths) == 0 {
		return NewRPCError(-32602, "paths are required")
	}
	_, err := gitCommandCombined(ctx, root, append([]string{"add", "--"}, paths...)...)
	return err
}

func (s *GitService) UnstageChanges(ctx context.Context, root string, paths []string) error {
	if len(paths) == 0 {
		return NewRPCError(-32602, "paths are required")
	}
	_, err := gitCommandCombined(ctx, root, append([]string{"restore", "--staged", "--"}, paths...)...)
	return err
}

func (s *GitService) RevertChanges(ctx context.Context, root string, paths []string) error {
	if len(paths) == 0 {
		return NewRPCError(-32602, "paths are required")
	}

	untrackedPaths, err := s.listUntrackedPaths(ctx, root, paths)
	if err != nil {
		return err
	}

	tracked := make([]string, 0, len(paths))
	untracked := make([]string, 0, len(paths))
	for _, p := range paths {
		if untrackedPaths[p] {
			untracked = append(untracked, p)
		} else {
			tracked = append(tracked, p)
		}
	}

	if len(tracked) > 0 {
		if _, err := gitCommandCombined(ctx, root, append([]string{"restore", "--staged", "--worktree", "--"}, tracked...)...); err != nil {
			return err
		}
	}
	if len(untracked) > 0 {
		if _, err := gitCommandCombined(ctx, root, append([]string{"clean", "-f", "--"}, untracked...)...); err != nil {
			return err
		}
	}

	return nil
}

func (s *GitService) CommitChanges(ctx context.Context, root string, message string, amend bool, signoff bool) (string, error) {
	if strings.TrimSpace(message) == "" {
		return "", NewRPCError(-32602, "message is required")
	}

	args := []string{"commit", "-m", message}
	if amend {
		args = append(args, "--amend")
	}
	if signoff {
		args = append(args, "--signoff")
	}
	if _, err := gitCommandCombined(ctx, root, args...); err != nil {
		return "", err
	}

	hash, err := gitCommand(ctx, root, "rev-parse", "HEAD")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(hash), nil
}

func (s *GitService) BranchStatus(ctx context.Context, root string) (GitBranchStatus, error) {
	tracking, err := gitCommand(ctx, root, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	hasUpstream := err == nil && strings.TrimSpace(tracking) != ""

	ahead := 0
	if hasUpstream {
		count, err := gitCommand(ctx, root, "rev-list", "--count", "@{u}..HEAD")
		if err == nil {
			fmt.Sscanf(strings.TrimSpace(count), "%d", &ahead)
		}
	}

	return GitBranchStatus{HasUpstream: hasUpstream, AheadCount: ahead}, nil
}

func (s *GitService) BranchPullRequest(ctx context.Context, root string, branch string) (GitBranchPullRequestStatus, error) {
	return s.branchPullRequest(ctx, root, branch, false, true)
}

func (s *GitService) BranchPullRequestLite(ctx context.Context, root string, branch string) (GitBranchPullRequestStatus, error) {
	return s.branchPullRequest(ctx, root, branch, false, false)
}

// BranchPullRequestWithDetails returns the PR for the given branch including
// checks and deployments. The PR list lookup respects the 30-second cache to
// throttle gh CLI calls, but checks are always fetched fresh.
func (s *GitService) BranchPullRequestWithDetails(ctx context.Context, root string, branch string) (GitBranchPullRequestStatus, error) {
	return s.branchPullRequest(ctx, root, branch, false, true)
}

func (s *GitService) RefreshBranchPullRequest(ctx context.Context, root string, branch string) (GitBranchPullRequestStatus, error) {
	return s.branchPullRequest(ctx, root, branch, true, true)
}

func (s *GitService) branchPullRequest(ctx context.Context, root string, branch string, refresh bool, includeDetails bool) (GitBranchPullRequestStatus, error) {
	branchName := strings.TrimSpace(branch)
	if branchName == "" {
		return GitBranchPullRequestStatus{}, NewRPCError(-32602, "branch is required")
	}

	cacheKey := root + "\n" + branchName
	if !refresh {
		s.mu.RLock()
		entry, ok := s.branchPullRequestCache[cacheKey]
		s.mu.RUnlock()
		if ok && time.Since(entry.at) < branchPullRequestCacheTTL {
			return entry.data, nil
		}
	}

	if refresh {
		s.mu.Lock()
		delete(s.branchPullRequestCache, cacheKey)
		s.mu.Unlock()
	}

	out, err := ghCommand(ctx, root,
		"pr", "list",
		"--head", branchName,
		"--state", "all",
		"--limit", "1",
		"--json", "number,title,url,state,reviewDecision,isDraft,mergedAt,headRefName,baseRefName,headRefOid",
	)
	if err != nil {
		return GitBranchPullRequestStatus{}, err
	}

	type ghPullRequest struct {
		Number         int    `json:"number"`
		Title          string `json:"title"`
		URL            string `json:"url"`
		State          string `json:"state"`
		ReviewDecision string `json:"reviewDecision"`
		IsDraft        bool   `json:"isDraft"`
		MergedAt       string `json:"mergedAt"`
		HeadRefName    string `json:"headRefName"`
		BaseRefName    string `json:"baseRefName"`
		HeadRefOID     string `json:"headRefOid"`
	}

	prs := make([]ghPullRequest, 0)
	if err := json.Unmarshal([]byte(out), &prs); err != nil {
		return GitBranchPullRequestStatus{}, NewRPCError(-32010, "failed to parse gh pr list output")
	}

	if len(prs) == 0 {
		status := GitBranchPullRequestStatus{Found: false, Branch: branchName}
		s.mu.Lock()
		s.branchPullRequestCache[cacheKey] = branchPullRequestCacheEntry{data: status, at: time.Now()}
		s.mu.Unlock()
		return status, nil
	}

	pr := prs[0]
	checks := []GitPullRequestCheck{}
	deployments := []GitPullRequestDeployment{}
	if includeDetails {
		checks, err = getPullRequestChecks(ctx, root, pr.Number, pr.HeadRefOID)
		if err != nil {
			return GitBranchPullRequestStatus{}, err
		}
		deployments, err = getPullRequestDeployments(ctx, root, pr.HeadRefOID)
		if err != nil {
			return GitBranchPullRequestStatus{}, err
		}
	}
	status := GitBranchPullRequestStatus{
		Found:          true,
		Branch:         branchName,
		Number:         pr.Number,
		Title:          pr.Title,
		URL:            pr.URL,
		State:          pr.State,
		ReviewDecision: pr.ReviewDecision,
		IsDraft:        pr.IsDraft,
		MergedAt:       pr.MergedAt,
		HeadRefName:    pr.HeadRefName,
		BaseRefName:    pr.BaseRefName,
		Checks:         checks,
		Deployments:    deployments,
	}

	s.mu.Lock()
	s.branchPullRequestCache[cacheKey] = branchPullRequestCacheEntry{data: status, at: time.Now()}
	s.mu.Unlock()
	return status, nil
}

func getPullRequestChecks(ctx context.Context, root string, prNumber int, headRefOID string) ([]GitPullRequestCheck, error) {
	// Use the GitHub REST API to get check runs with correct html_url links.
	// gh pr checks --json only provides marketplace/app links, not check run URLs.
	if strings.TrimSpace(headRefOID) != "" {
		type ghCheckRun struct {
			Name       string `json:"name"`
			Status     string `json:"status"`
			Conclusion string `json:"conclusion"`
			HTMLURL    string `json:"html_url"`
		}
		type ghCheckRunsResponse struct {
			CheckRuns []ghCheckRun `json:"check_runs"`
		}

		var resp ghCheckRunsResponse
		if err := ghJSON(ctx, root, &resp,
			"api", fmt.Sprintf("repos/{owner}/{repo}/commits/%s/check-runs", headRefOID),
		); err == nil && len(resp.CheckRuns) > 0 {
			result := make([]GitPullRequestCheck, 0, len(resp.CheckRuns))
			for _, run := range resp.CheckRuns {
				state := run.Conclusion
				if state == "" {
					state = run.Status
				}
				result = append(result, GitPullRequestCheck{
					Name:  run.Name,
					State: strings.ToUpper(state),
					URL:   run.HTMLURL,
				})
			}
			return result, nil
		}
	}

	// Fall back to gh pr checks if headRefOID is empty or API call failed.
	type ghCheck struct {
		Name        string `json:"name"`
		Workflow    string `json:"workflow"`
		State       string `json:"state"`
		Description string `json:"description"`
		Link        string `json:"link"`
	}

	checks := make([]ghCheck, 0)
	if err := ghJSON(ctx, root, &checks,
		"pr", "checks", fmt.Sprintf("%d", prNumber),
		"--required=false",
		"--json", "name,workflow,state,description,link",
	); err != nil {
		return nil, err
	}

	result := make([]GitPullRequestCheck, 0, len(checks))
	for _, check := range checks {
		result = append(result, GitPullRequestCheck{
			Name:        check.Name,
			Workflow:    check.Workflow,
			State:       check.State,
			Description: check.Description,
			URL:         check.Link,
		})
	}
	return result, nil
}

func getPullRequestDeployments(ctx context.Context, root string, headRefOID string) ([]GitPullRequestDeployment, error) {
	if strings.TrimSpace(headRefOID) == "" {
		return []GitPullRequestDeployment{}, nil
	}

	type ghRepo struct {
		NameWithOwner string `json:"nameWithOwner"`
	}
	repo := ghRepo{}
	if err := ghJSON(ctx, root, &repo, "api", "repos/{owner}/{repo}"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(repo.NameWithOwner) == "" {
		return []GitPullRequestDeployment{}, nil
	}

	type ghDeployment struct {
		ID              int64  `json:"id"`
		Environment     string `json:"environment"`
		Description     string `json:"description"`
		OriginalPayload string `json:"original_payload"`
		CreatedAt       string `json:"created_at"`
		UpdatedAt       string `json:"updated_at"`
	}

	deployments := make([]ghDeployment, 0)
	if err := ghJSON(ctx, root, &deployments,
		"api",
		fmt.Sprintf("repos/%s/deployments", repo.NameWithOwner),
		"-f", "sha="+headRefOID,
		"-f", "per_page=20",
	); err != nil {
		return nil, err
	}

	result := make([]GitPullRequestDeployment, 0, len(deployments))
	for _, deployment := range deployments {
		status, envURL, statusDescription, err := getDeploymentStatus(ctx, root, repo.NameWithOwner, deployment.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, GitPullRequestDeployment{
			ID:              deployment.ID,
			Environment:     deployment.Environment,
			State:           status,
			Description:     coalesceNonEmpty(statusDescription, deployment.Description),
			EnvironmentURL:  envURL,
			CreatedAt:       deployment.CreatedAt,
			UpdatedAt:       deployment.UpdatedAt,
			OriginalPayload: deployment.OriginalPayload,
		})
	}

	return result, nil
}

func getDeploymentStatus(ctx context.Context, root string, repo string, deploymentID int64) (state string, environmentURL string, description string, err error) {
	type ghDeploymentStatus struct {
		State          string `json:"state"`
		EnvironmentURL string `json:"environment_url"`
		Description    string `json:"description"`
	}

	statuses := make([]ghDeploymentStatus, 0)
	err = ghJSON(ctx, root, &statuses,
		"api",
		fmt.Sprintf("repos/%s/deployments/%d/statuses", repo, deploymentID),
		"-f", "per_page=1",
	)
	if err != nil {
		return "", "", "", err
	}
	if len(statuses) == 0 {
		return "", "", "", nil
	}
	return statuses[0].State, statuses[0].EnvironmentURL, statuses[0].Description, nil
}

func (s *GitService) ListCommitsToTarget(ctx context.Context, root string, targetBranch string) (GitCommitComparison, error) {
	if strings.TrimSpace(targetBranch) == "" {
		return GitCommitComparison{}, NewRPCError(-32602, "targetBranch is required")
	}

	currentBranch, _ := gitCommand(ctx, root, "rev-parse", "--abbrev-ref", "HEAD")
	logOut, err := gitCommand(ctx, root, "log", "--no-decorate", "--date=iso-strict", "--name-only", "--pretty=format:%x1e%H%x1f%h%x1f%an%x1f%aI%x1f%s", fmt.Sprintf("%s..HEAD", targetBranch))
	if err != nil {
		return GitCommitComparison{}, err
	}
	allChanged, err := gitCommand(ctx, root, "diff", "--name-only", fmt.Sprintf("%s...HEAD", targetBranch))
	if err != nil {
		return GitCommitComparison{}, err
	}

	commits := make([]GitCommit, 0)
	for record := range strings.SplitSeq(logOut, "\x1e") {
		record = strings.TrimSpace(record)
		if record == "" {
			continue
		}
		lines := make([]string, 0)
		for line := range strings.SplitSeq(record, "\n") {
			lines = append(lines, line)
		}
		meta := strings.Split(lines[0], "\x1f")
		if len(meta) < 5 {
			continue
		}
		changed := make([]string, 0)
		for _, line := range lines[1:] {
			line = strings.TrimSpace(line)
			if line != "" {
				changed = append(changed, line)
			}
		}
		commits = append(commits, GitCommit{
			Hash:         meta[0],
			ShortHash:    meta[1],
			AuthorName:   meta[2],
			CommittedAt:  meta[3],
			Subject:      meta[4],
			ChangedFiles: changed,
		})
	}

	allChangedFiles := make([]string, 0)
	for line := range strings.SplitSeq(allChanged, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			allChangedFiles = append(allChangedFiles, line)
		}
	}

	return GitCommitComparison{
		CurrentBranch:   strings.TrimSpace(currentBranch),
		TargetBranch:    strings.TrimSpace(targetBranch),
		AllChangedFiles: allChangedFiles,
		Commits:         commits,
	}, nil
}

func (s *GitService) BranchDiffSummary(ctx context.Context, root string, targetBranch string) (GitBranchDiffSummary, error) {
	if strings.TrimSpace(targetBranch) == "" {
		return GitBranchDiffSummary{}, NewRPCError(-32602, "targetBranch is required")
	}

	// Use three-dot diff to compare HEAD against merge-base with targetBranch.
	numstat, err := gitCommand(ctx, root, "diff", "--numstat", fmt.Sprintf("%s...HEAD", targetBranch))
	if err != nil {
		return GitBranchDiffSummary{}, err
	}

	stats := parseNumstat(numstat)
	files := make([]string, 0, len(stats))
	additions := 0
	deletions := 0
	for path, v := range stats {
		files = append(files, path)
		additions += v[0]
		deletions += v[1]
	}
	sort.Strings(files)

	return GitBranchDiffSummary{FileCount: len(files), Additions: additions, Deletions: deletions, Files: files}, nil
}

func (s *GitService) ReadCommitDiff(ctx context.Context, root string, commitHash string, path string) (GitDiffContent, error) {
	if strings.TrimSpace(commitHash) == "" || strings.TrimSpace(path) == "" {
		return GitDiffContent{}, NewRPCError(-32602, "commitHash and path are required")
	}
	oldContent, _ := gitCommand(ctx, root, "show", fmt.Sprintf("%s^:%s", commitHash, path))
	newContent, _ := gitCommand(ctx, root, "show", fmt.Sprintf("%s:%s", commitHash, path))
	return GitDiffContent{OldContent: oldContent, NewContent: newContent}, nil
}

func (s *GitService) ReadBranchComparisonDiff(ctx context.Context, root string, targetBranch string, path string) (GitDiffContent, error) {
	if strings.TrimSpace(targetBranch) == "" || strings.TrimSpace(path) == "" {
		return GitDiffContent{}, NewRPCError(-32602, "targetBranch and path are required")
	}
	oldContent, _ := gitCommand(ctx, root, "show", fmt.Sprintf("%s:%s", targetBranch, path))
	newContent, _ := gitCommand(ctx, root, "show", fmt.Sprintf("HEAD:%s", path))
	return GitDiffContent{OldContent: oldContent, NewContent: newContent}, nil
}

func (s *GitService) ListBranches(ctx context.Context, root string) (GitBranchList, error) {
	s.mu.RLock()
	entry, ok := s.branchCache[root]
	s.mu.RUnlock()
	if ok && time.Since(entry.at) < branchCacheTTL {
		return entry.data, nil
	}

	fetchCtx, cancel := context.WithTimeout(ctx, fetchTimeout)
	s.FetchRef(fetchCtx, root, "")
	cancel()

	list, err := s.listBranchesFromGit(ctx, root)
	if err != nil {
		return GitBranchList{}, err
	}

	s.mu.Lock()
	s.branchCache[root] = branchCacheEntry{data: list, at: time.Now()}
	s.mu.Unlock()
	return list, nil
}

func (s *GitService) listBranchesFromGit(ctx context.Context, root string) (GitBranchList, error) {
	out, err := gitCommand(ctx, root, "branch", "--all", "--no-color")
	if err != nil {
		return GitBranchList{}, err
	}
	currentOut, _ := gitCommand(ctx, root, "rev-parse", "--abbrev-ref", "HEAD")
	current := strings.TrimSpace(currentOut)
	set := map[string]bool{}
	localSet := map[string]bool{}
	remoteSet := map[string]bool{}
	worktreeSet := map[string]bool{}
	for line := range strings.SplitSeq(out, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		isCurrent := strings.HasPrefix(trimmed, "*")
		isWorktree := strings.HasPrefix(trimmed, "+")
		name := strings.TrimSpace(strings.TrimLeft(trimmed, "*+"))
		name = strings.TrimPrefix(name, "remotes/")
		if strings.HasSuffix(name, "->") || strings.Contains(name, " -> ") || name == "" {
			continue
		}

		set[name] = true
		if strings.Contains(trimmed, "remotes/") {
			remoteSet[name] = true
			continue
		}

		if isWorktree && !isCurrent {
			worktreeSet[name] = true
			continue
		}

		localSet[name] = true
	}
	branches := make([]string, 0, len(set))
	for b := range set {
		branches = append(branches, b)
	}
	localBranches := make([]string, 0, len(localSet))
	for b := range localSet {
		localBranches = append(localBranches, b)
	}
	remoteBranches := make([]string, 0, len(remoteSet))
	for b := range remoteSet {
		remoteBranches = append(remoteBranches, b)
	}
	worktreeBranches := make([]string, 0, len(worktreeSet))
	for b := range worktreeSet {
		worktreeBranches = append(worktreeBranches, b)
	}
	sort.Strings(branches)
	sort.Strings(localBranches)
	sort.Strings(remoteBranches)
	sort.Strings(worktreeBranches)
	if current != "" && !set[current] {
		branches = append([]string{current}, branches...)
		localBranches = append([]string{current}, localBranches...)
	}
	return GitBranchList{
		CurrentBranch:    current,
		Branches:         branches,
		LocalBranches:    localBranches,
		RemoteBranches:   remoteBranches,
		WorktreeBranches: worktreeBranches,
	}, nil
}

func (s *GitService) PushBranch(ctx context.Context, root string) (string, error) {
	out, err := gitCommandCombined(ctx, root, "push")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

func (s *GitService) PublishBranch(ctx context.Context, root string) (string, error) {
	remote := "origin"
	remotesOut, err := gitCommand(ctx, root, "remote")
	if err == nil {
		remotes := splitNonEmptyLines(remotesOut)
		if !slices.Contains(remotes, "origin") {
			if len(remotes) == 0 {
				return "", NewRPCError(-32010, "no git remote configured")
			}
			remote = remotes[0]
		}
	}

	out, err := gitCommandCombined(ctx, root, "push", remote, "HEAD", "-u")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

func (s *GitService) RenameBranch(ctx context.Context, root string, nextBranch string) error {
	if strings.TrimSpace(nextBranch) == "" {
		return NewRPCError(-32602, "nextBranch is required")
	}
	_, err := gitCommandCombined(ctx, root, "branch", "-m", nextBranch)
	return err
}

func (s *GitService) CurrentBranch(ctx context.Context, root string) (string, error) {
	out, err := gitCommand(ctx, root, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", err
	}
	branch := strings.TrimSpace(out)
	if branch == "" || branch == "HEAD" {
		return "", NewRPCError(-32010, "workspace is not on a branch")
	}
	return branch, nil
}

func (s *GitService) MainWorktreePath(ctx context.Context, root string) (string, error) {
	out, err := gitCommand(ctx, root, "worktree", "list", "--porcelain")
	if err != nil {
		return "", err
	}
	for line := range strings.SplitSeq(out, "\n") {
		if path, ok := strings.CutPrefix(line, "worktree "); ok {
			path = strings.TrimSpace(path)
			if path != "" {
				return path, nil
			}
		}
	}
	return "", NewRPCError(-32010, "main worktree not found")
}

func (s *GitService) RemoveBranch(ctx context.Context, root string, branch string, force bool) error {
	if strings.TrimSpace(branch) == "" {
		return NewRPCError(-32602, "branch is required")
	}
	flag := "-d"
	if force {
		flag = "-D"
	}
	_, err := gitCommandCombined(ctx, root, "branch", flag, branch)
	return err
}

func (s *GitService) FetchRef(ctx context.Context, root string, ref string) error {
	remotesOut, err := gitCommand(ctx, root, "remote")
	if err != nil {
		return err
	}
	remotes := splitNonEmptyLines(remotesOut)
	if len(remotes) == 0 {
		return nil
	}

	remote := "origin"
	if !slices.Contains(remotes, "origin") {
		remote = remotes[0]
	}

	args := []string{"fetch", remote, "--quiet", "--no-tags"}
	if strings.TrimSpace(ref) != "" && ref != "HEAD" {
		args = append(args, ref)
	}

	_, err = gitCommandCombined(ctx, root, args...)
	return err
}

func (s *GitService) CreateWorktree(ctx context.Context, root string, branch string, worktreePath string, createBranch bool, fromRef string) error {
	if strings.TrimSpace(branch) == "" {
		return NewRPCError(-32602, "branch is required")
	}
	if strings.TrimSpace(worktreePath) == "" {
		return NewRPCError(-32602, "worktreePath is required")
	}

	absWorktreePath, err := filepath.Abs(worktreePath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(absWorktreePath), 0o755); err != nil {
		return err
	}

	if createBranch {
		ref := strings.TrimSpace(fromRef)
		if ref == "" {
			ref = "HEAD"
		}
		_, err := gitCommandCombined(ctx, root, "worktree", "add", "-b", branch, absWorktreePath, ref)
		return err
	}

	_, err = gitCommandCombined(ctx, root, "worktree", "add", absWorktreePath, branch)
	return err
}

func (s *GitService) RemoveWorktree(ctx context.Context, root string, worktreePath string, force bool) error {
	if strings.TrimSpace(worktreePath) == "" {
		return NewRPCError(-32602, "worktreePath is required")
	}

	absWorktreePath, err := filepath.Abs(worktreePath)
	if err != nil {
		return err
	}

	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, absWorktreePath)
	_, err = gitCommandCombined(ctx, root, args...)
	return err
}

func (s *GitService) AuthorName(ctx context.Context, root string) (string, error) {
	out, err := gitCommand(ctx, root, "config", "user.name")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

func (s *GitService) listUntrackedPaths(ctx context.Context, root string, paths []string) (map[string]bool, error) {
	if len(paths) == 0 {
		return map[string]bool{}, nil
	}
	out, err := gitCommand(ctx, root, append([]string{"ls-files", "--others", "--exclude-standard", "--"}, paths...)...)
	if err != nil {
		return nil, err
	}
	set := map[string]bool{}
	for _, line := range splitNonEmptyLines(out) {
		set[line] = true
	}
	return set, nil
}

func parseStatusOutput(raw string) GitStatusResponse {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return GitStatusResponse{Branch: "", Files: nil, Raw: ""}
	}

	lines := make([]string, 0)
	for line := range strings.SplitSeq(raw, "\n") {
		lines = append(lines, line)
	}
	resp := GitStatusResponse{Raw: raw}
	if len(lines) > 0 && strings.HasPrefix(lines[0], "##") {
		resp.Branch = strings.TrimSpace(strings.TrimPrefix(lines[0], "##"))
		lines = lines[1:]
	}

	files := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if len(line) > 3 {
			files = append(files, strings.TrimSpace(line[3:]))
		} else {
			files = append(files, line)
		}
	}
	resp.Files = files
	return resp
}

func gitCommand(ctx context.Context, cwd string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", cwd}, args...)...)
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return "", NewRPCError(-32010, strings.TrimSpace(string(exitErr.Stderr)))
		}
		return "", err
	}
	return string(out), nil
}

func gitCommandCombined(ctx context.Context, cwd string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", append([]string{"-C", cwd}, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", NewRPCError(-32010, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func ghCommand(ctx context.Context, cwd string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "gh", args...)
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()
	if err != nil {
		if errors.Is(err, exec.ErrNotFound) {
			return "", NewRPCError(-32010, "GitHub CLI (gh) is not installed")
		}
		return "", NewRPCError(-32010, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func ghJSON(ctx context.Context, cwd string, target any, args ...string) error {
	out, err := ghCommand(ctx, cwd, args...)
	if err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(out), target); err != nil {
		return NewRPCError(-32010, "failed to parse gh output")
	}
	return nil
}

func coalesceNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func splitNonEmptyLines(input string) []string {
	out := make([]string, 0)
	for line := range strings.SplitSeq(input, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}

func parseNumstat(raw string) map[string][2]int {
	out := map[string][2]int{}
	for line := range strings.SplitSeq(strings.TrimSpace(raw), "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\t")
		if len(parts) < 3 {
			continue
		}
		var add, del int
		fmt.Sscanf(parts[0], "%d", &add)
		fmt.Sscanf(parts[1], "%d", &del)
		out[parts[2]] = [2]int{add, del}
	}
	return out
}

func statValue(v [2]int) (int, int) {
	return v[0], v[1]
}

func normalizeStatusPath(path string) string {
	trimmedPath := strings.TrimSpace(path)
	if trimmedPath == "" {
		return ""
	}

	arrowIndex := strings.LastIndex(trimmedPath, " -> ")
	if arrowIndex <= 0 {
		return strings.Trim(trimmedPath, "\"")
	}

	renameDestinationPath := strings.TrimSpace(trimmedPath[arrowIndex+4:])
	return strings.Trim(renameDestinationPath, "\"")
}

func mapStatusToKind(status byte) string {
	switch status {
	case 'A':
		return "added"
	case 'M':
		return "modified"
	case 'D':
		return "deleted"
	case 'R':
		return "renamed"
	case 'C':
		return "copied"
	default:
		return "modified"
	}
}
