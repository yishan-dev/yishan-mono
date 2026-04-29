package workspace

import (
	"context"
	"path/filepath"
	"strings"
)

type CreateRequest struct {
	ID           string `json:"id"`
	SourcePath   string `json:"sourcePath"`
	WorktreePath string `json:"worktreePath"`
	Branch       string `json:"branch"`
	SourceBranch string `json:"sourceBranch"`
}

func (m *Manager) CreateWorkspace(ctx context.Context, req CreateRequest) (Workspace, error) {
	if strings.TrimSpace(req.ID) == "" {
		return Workspace{}, NewRPCError(-32602, "id is required")
	}
	if strings.TrimSpace(req.SourcePath) == "" {
		return Workspace{}, NewRPCError(-32602, "sourcePath is required")
	}
	if strings.TrimSpace(req.WorktreePath) == "" {
		return Workspace{}, NewRPCError(-32602, "worktreePath is required")
	}
	if strings.TrimSpace(req.Branch) == "" {
		return Workspace{}, NewRPCError(-32602, "branch is required")
	}
	if strings.TrimSpace(req.SourceBranch) == "" {
		return Workspace{}, NewRPCError(-32602, "sourceBranch is required")
	}

	sourcePath, err := filepath.Abs(req.SourcePath)
	if err != nil {
		return Workspace{}, err
	}
	worktreePath, err := filepath.Abs(req.WorktreePath)
	if err != nil {
		return Workspace{}, err
	}

	if err := m.gits.CreateWorktree(ctx, sourcePath, req.Branch, worktreePath, true, strings.TrimSpace(req.SourceBranch)); err != nil {
		return Workspace{}, err
	}

	ws := Workspace{ID: strings.TrimSpace(req.ID), Path: worktreePath}
	m.mu.Lock()
	m.workspaces[ws.ID] = ws
	m.mu.Unlock()

	return ws, nil
}
