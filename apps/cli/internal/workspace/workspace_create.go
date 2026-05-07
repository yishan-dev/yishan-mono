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

	reportProgress("validate", "Validate workspace inputs", CreateProgressRunning, "")
	if strings.TrimSpace(req.ID) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "id is required")
		return Workspace{}, NewRPCError(-32602, "id is required")
	}
	if strings.TrimSpace(req.SourcePath) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "sourcePath is required")
		return Workspace{}, NewRPCError(-32602, "sourcePath is required")
	}
	if strings.TrimSpace(req.RepoKey) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "repoKey is required")
		return Workspace{}, NewRPCError(-32602, "repoKey is required")
	}
	if strings.TrimSpace(req.WorkspaceName) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "workspaceName is required")
		return Workspace{}, NewRPCError(-32602, "workspaceName is required")
	}
	if strings.TrimSpace(req.TargetBranch) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "targetBranch is required")
		return Workspace{}, NewRPCError(-32602, "targetBranch is required")
	}
	if strings.TrimSpace(req.SourceBranch) == "" {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, "sourceBranch is required")
		return Workspace{}, NewRPCError(-32602, "sourceBranch is required")
	}
	reportProgress("validate", "Validate workspace inputs", CreateProgressCompleted, "")

	sourcePath, err := absUserPath(req.SourcePath)
	if err != nil {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, err.Error())
		return Workspace{}, err
	}
	repoKey, err := safeRelativePath(req.RepoKey, "repoKey")
	if err != nil {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, err.Error())
		return Workspace{}, err
	}
	workspaceName, err := safeRelativePath(req.WorkspaceName, "workspaceName")
	if err != nil {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, err.Error())
		return Workspace{}, err
	}
	worktreePath, err := defaultWorktreePath(repoKey, workspaceName)
	if err != nil {
		reportProgress("validate", "Validate workspace inputs", CreateProgressFailed, err.Error())
		return Workspace{}, err
	}

	reportProgress("worktree", "Create local worktree", CreateProgressRunning, "")
	if err := m.gits.CreateWorktree(ctx, sourcePath, req.TargetBranch, worktreePath, true, strings.TrimSpace(req.SourceBranch)); err != nil {
		reportProgress("worktree", "Create local worktree", CreateProgressFailed, err.Error())
		return Workspace{}, err
	}
	reportProgress("worktree", "Create local worktree", CreateProgressCompleted, worktreePath)

	reportProgress("context", "Link project context", CreateProgressRunning, "")
	if req.ContextEnabled {
		contextPath, err := defaultContextPath(repoKey)
		if err != nil {
			reportProgress("context", "Link project context", CreateProgressFailed, err.Error())
			return Workspace{}, err
		}
		if err := ensureContextLink(contextPath, worktreePath); err != nil {
			reportProgress("context", "Link project context", CreateProgressFailed, err.Error())
			return Workspace{}, fmt.Errorf("create context link: %w", err)
		}
		reportProgress("context", "Link project context", CreateProgressCompleted, "")
	} else {
		reportProgress("context", "Link project context", CreateProgressSkipped, "Context link disabled")
	}

	ws := Workspace{ID: strings.TrimSpace(req.ID), Path: worktreePath}

	reportProgress("setup", "Run setup script", CreateProgressRunning, "")
	hookResult, hookErr := RunHook(ctx, HookRequest{
		Command:       req.SetupHook,
		WorkspaceID:   ws.ID,
		WorkspacePath: ws.Path,
		HookName:      "setup",
	})
	if hookErr != nil {
		// System-level hook failure (e.g. shell not found). Treat as
		// non-fatal: workspace was created successfully, surface the error
		// in the result so callers can warn the user.
		hookResult.Error = fmt.Sprintf("setup hook: %v", hookErr)
		ws.SetupHookResult = &hookResult
		reportProgress("setup", "Run setup script", CreateProgressWarning, hookResult.Error)
	} else if !hookResult.Skipped {
		ws.SetupHookResult = &hookResult
		if hookResult.Error != "" {
			reportProgress("setup", "Run setup script", CreateProgressWarning, hookResult.Error)
		} else {
			reportProgress("setup", "Run setup script", CreateProgressCompleted, "")
		}
	} else {
		reportProgress("setup", "Run setup script", CreateProgressSkipped, "No setup script configured")
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
