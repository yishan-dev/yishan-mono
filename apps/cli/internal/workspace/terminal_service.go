package workspace

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
)

type TerminalStartRequest struct {
	WorkspaceID string   `json:"workspaceId"`
	Command     string   `json:"command"`
	Args        []string `json:"args,omitempty"`
	Env         []string `json:"env,omitempty"`
}

type TerminalStartResponse struct {
	SessionID string `json:"sessionId"`
}

type TerminalSendRequest struct {
	SessionID string `json:"sessionId"`
	Input     string `json:"input"`
}

type TerminalSendResponse struct {
	Written int `json:"written"`
}

type TerminalReadRequest struct {
	SessionID string `json:"sessionId"`
}

type TerminalReadResponse struct {
	Output   string `json:"output"`
	ExitCode *int   `json:"exitCode,omitempty"`
	Running  bool   `json:"running"`
}

type TerminalStopRequest struct {
	SessionID string `json:"sessionId"`
}

type TerminalStopResponse struct {
	Stopped bool `json:"stopped"`
}

type TerminalManager struct {
	mu       sync.RWMutex
	nextID   atomic.Uint64
	sessions map[string]*terminalSession
}

type terminalSession struct {
	id       string
	cmd      *exec.Cmd
	stdin    io.WriteCloser
	output   bytes.Buffer
	outputMu sync.Mutex
	running  atomic.Bool
	exitCode atomic.Int32
}

func NewTerminalManager() *TerminalManager {
	return &TerminalManager{sessions: make(map[string]*terminalSession)}
}

func (m *TerminalManager) Start(_ context.Context, cwd string, req TerminalStartRequest) (TerminalStartResponse, error) {
	if req.Command == "" {
		return TerminalStartResponse{}, NewRPCError(-32602, "command is required")
	}

	cmd := exec.Command(req.Command, req.Args...)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), req.Env...)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return TerminalStartResponse{}, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return TerminalStartResponse{}, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return TerminalStartResponse{}, err
	}

	id := fmt.Sprintf("term-%d", m.nextID.Add(1))
	s := &terminalSession{id: id, cmd: cmd, stdin: stdin}
	s.running.Store(true)
	s.exitCode.Store(-1)

	if err := cmd.Start(); err != nil {
		return TerminalStartResponse{}, err
	}

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	go s.capture(stdout)
	go s.capture(stderr)
	go func() {
		err := cmd.Wait()
		code := int32(0)
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				code = int32(exitErr.ExitCode())
			} else {
				code = -1
			}
		}
		s.exitCode.Store(code)
		s.running.Store(false)
		_ = s.stdin.Close()
	}()

	return TerminalStartResponse{SessionID: id}, nil
}

func (m *TerminalManager) Send(req TerminalSendRequest) (TerminalSendResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalSendResponse{}, err
	}

	if !s.running.Load() {
		return TerminalSendResponse{}, NewRPCError(-32005, "terminal session not running")
	}

	n, err := io.WriteString(s.stdin, req.Input)
	if err != nil {
		return TerminalSendResponse{}, err
	}
	return TerminalSendResponse{Written: n}, nil
}

func (m *TerminalManager) Read(req TerminalReadRequest) (TerminalReadResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalReadResponse{}, err
	}

	s.outputMu.Lock()
	out := s.output.String()
	s.output.Reset()
	s.outputMu.Unlock()

	running := s.running.Load()
	if running {
		return TerminalReadResponse{Output: out, Running: true}, nil
	}

	code := int(s.exitCode.Load())
	return TerminalReadResponse{Output: out, ExitCode: &code, Running: false}, nil
}

func (m *TerminalManager) Stop(req TerminalStopRequest) (TerminalStopResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalStopResponse{}, err
	}

	if s.running.Load() {
		if err := s.cmd.Process.Kill(); err != nil {
			return TerminalStopResponse{}, err
		}
		s.running.Store(false)
	}

	m.mu.Lock()
	delete(m.sessions, s.id)
	m.mu.Unlock()

	return TerminalStopResponse{Stopped: true}, nil
}

func (m *TerminalManager) session(id string) (*terminalSession, error) {
	if id == "" {
		return nil, NewRPCError(-32602, "sessionId is required")
	}

	m.mu.RLock()
	s, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return nil, NewRPCError(-32004, "terminal session not found")
	}
	return s, nil
}

func (s *terminalSession) capture(r io.Reader) {
	_, _ = io.Copy(sessionBufferWriter{s: s}, r)
}

type sessionBufferWriter struct {
	s *terminalSession
}

func (w sessionBufferWriter) Write(p []byte) (int, error) {
	w.s.outputMu.Lock()
	defer w.s.outputMu.Unlock()
	return w.s.output.Write(p)
}
