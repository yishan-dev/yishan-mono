package workspace

import (
	"context"
	"os"
	"path/filepath"
	"sync"
)

type Workspace struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

type Manager struct {
	mu         sync.RWMutex
	workspaces map[string]Workspace
	terminals  *TerminalManager
}

func NewManager() *Manager {
	return &Manager{
		workspaces: make(map[string]Workspace),
		terminals:  NewTerminalManager(),
	}
}

type OpenRequest struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

func (m *Manager) Open(req OpenRequest) (Workspace, error) {
	if req.ID == "" || req.Path == "" {
		return Workspace{}, NewRPCError(-32602, "id and path are required")
	}

	absPath, err := filepath.Abs(req.Path)
	if err != nil {
		return Workspace{}, err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return Workspace{}, err
	}
	if !info.IsDir() {
		return Workspace{}, NewRPCError(-32602, "workspace path must be a directory")
	}

	ws := Workspace{ID: req.ID, Path: absPath}

	m.mu.Lock()
	m.workspaces[req.ID] = ws
	m.mu.Unlock()

	return ws, nil
}

func (m *Manager) List() []Workspace {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]Workspace, 0, len(m.workspaces))
	for _, ws := range m.workspaces {
		out = append(out, ws)
	}
	return out
}

func (m *Manager) getWorkspace(id string) (Workspace, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ws, ok := m.workspaces[id]
	if !ok {
		return Workspace{}, NewRPCError(-32004, "workspace not found")
	}
	return ws, nil
}

func (m *Manager) GitStatus(ctx context.Context, req GitStatusRequest) (GitStatusResponse, error) {
	ws, err := m.getWorkspace(req.WorkspaceID)
	if err != nil {
		return GitStatusResponse{}, err
	}
	return GitStatus(ctx, ws.Path)
}

func (m *Manager) TerminalStart(ctx context.Context, req TerminalStartRequest) (TerminalStartResponse, error) {
	ws, err := m.getWorkspace(req.WorkspaceID)
	if err != nil {
		return TerminalStartResponse{}, err
	}
	return m.terminals.Start(ctx, ws.Path, req)
}

func (m *Manager) TerminalSend(req TerminalSendRequest) (TerminalSendResponse, error) {
	return m.terminals.Send(req)
}

func (m *Manager) TerminalRead(req TerminalReadRequest) (TerminalReadResponse, error) {
	return m.terminals.Read(req)
}

func (m *Manager) TerminalStop(req TerminalStopRequest) (TerminalStopResponse, error) {
	return m.terminals.Stop(req)
}

func (m *Manager) TerminalResize(req TerminalResizeRequest) (TerminalResizeResponse, error) {
	return m.terminals.Resize(req)
}

func (m *Manager) TerminalSubscribe(req TerminalSubscribeRequest) (TerminalSubscription, error) {
	return m.terminals.Subscribe(req)
}

func (m *Manager) TerminalUnsubscribe(req TerminalUnsubscribeRequest) (TerminalUnsubscribeResponse, error) {
	return m.terminals.Unsubscribe(req)
}
