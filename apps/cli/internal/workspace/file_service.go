package workspace

import (
	"os"
	"path/filepath"
	"strings"
)

type FileReadRequest struct {
	WorkspaceID string `json:"workspaceId"`
	Path        string `json:"path"`
}

type FileReadResponse struct {
	Content string `json:"content"`
}

type FileWriteRequest struct {
	WorkspaceID string `json:"workspaceId"`
	Path        string `json:"path"`
	Content     string `json:"content"`
	Mode        uint32 `json:"mode,omitempty"`
}

type FileWriteResponse struct {
	Bytes int `json:"bytes"`
}

func (m *Manager) FileRead(req FileReadRequest) (FileReadResponse, error) {
	ws, err := m.getWorkspace(req.WorkspaceID)
	if err != nil {
		return FileReadResponse{}, err
	}

	path, err := safeJoin(ws.Path, req.Path)
	if err != nil {
		return FileReadResponse{}, err
	}

	b, err := os.ReadFile(path)
	if err != nil {
		return FileReadResponse{}, err
	}

	return FileReadResponse{Content: string(b)}, nil
}

func (m *Manager) FileWrite(req FileWriteRequest) (FileWriteResponse, error) {
	ws, err := m.getWorkspace(req.WorkspaceID)
	if err != nil {
		return FileWriteResponse{}, err
	}

	path, err := safeJoin(ws.Path, req.Path)
	if err != nil {
		return FileWriteResponse{}, err
	}

	mode := os.FileMode(0o644)
	if req.Mode != 0 {
		mode = os.FileMode(req.Mode)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return FileWriteResponse{}, err
	}

	if err := os.WriteFile(path, []byte(req.Content), mode); err != nil {
		return FileWriteResponse{}, err
	}

	return FileWriteResponse{Bytes: len(req.Content)}, nil
}

func safeJoin(root string, p string) (string, error) {
	if p == "" {
		return "", NewRPCError(-32602, "path is required")
	}

	candidate := filepath.Join(root, p)
	full, err := filepath.Abs(candidate)
	if err != nil {
		return "", err
	}

	cleanRoot := filepath.Clean(root)
	rel, err := filepath.Rel(cleanRoot, full)
	if err != nil {
		return "", err
	}

	if rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", NewRPCError(-32003, "path escapes workspace root")
	}

	return full, nil
}
