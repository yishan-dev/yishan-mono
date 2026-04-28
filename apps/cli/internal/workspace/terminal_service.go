package workspace

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/creack/pty"
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

type TerminalResizeRequest struct {
	SessionID string `json:"sessionId"`
	Cols      uint16 `json:"cols"`
	Rows      uint16 `json:"rows"`
}

type TerminalResizeResponse struct {
	Resized bool `json:"resized"`
}

type TerminalSubscribeRequest struct {
	SessionID string `json:"sessionId"`
}

type TerminalSubscribeResponse struct {
	Subscribed bool `json:"subscribed"`
}

type TerminalUnsubscribeRequest struct {
	SessionID      string `json:"sessionId"`
	SubscriptionID uint64 `json:"subscriptionId"`
}

type TerminalUnsubscribeResponse struct {
	Unsubscribed bool `json:"unsubscribed"`
}

type TerminalEvent struct {
	SessionID string `json:"sessionId"`
	Type      string `json:"type"`
	Chunk     string `json:"chunk,omitempty"`
	ExitCode  *int   `json:"exitCode,omitempty"`
}

type TerminalSubscription struct {
	ID     uint64
	Events <-chan TerminalEvent
}

type TerminalManager struct {
	mu        sync.RWMutex
	nextID    atomic.Uint64
	nextSubID atomic.Uint64
	sessions  map[string]*terminalSession
}

type terminalSession struct {
	id       string
	cmd      *exec.Cmd
	pty      *os.File
	output   bytes.Buffer
	outputMu sync.Mutex
	running  atomic.Bool
	exitCode atomic.Int32
	subsMu   sync.Mutex
	subs     map[uint64]chan TerminalEvent
}

func NewTerminalManager() *TerminalManager {
	return &TerminalManager{sessions: make(map[string]*terminalSession)}
}

func (m *TerminalManager) Start(_ context.Context, cwd string, req TerminalStartRequest) (TerminalStartResponse, error) {
	command, args := resolveTerminalCommand(req, runtime.GOOS, os.Getenv("SHELL"))

	cmd := exec.Command(command, args...)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), req.Env...)

	ptyFile, err := pty.Start(cmd)
	if err != nil {
		return TerminalStartResponse{}, err
	}

	id := fmt.Sprintf("term-%d", m.nextID.Add(1))
	s := &terminalSession{id: id, cmd: cmd, pty: ptyFile, subs: make(map[uint64]chan TerminalEvent)}
	s.running.Store(true)
	s.exitCode.Store(-1)

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	go s.capture()
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
		_ = s.pty.Close()

		exit := int(code)
		s.broadcast(TerminalEvent{SessionID: s.id, Type: "exit", ExitCode: &exit})
		s.closeSubscribers()
	}()

	return TerminalStartResponse{SessionID: id}, nil
}

func resolveTerminalCommand(req TerminalStartRequest, goos string, shellEnv string) (string, []string) {
	command := strings.TrimSpace(req.Command)
	if command != "" {
		return command, req.Args
	}

	defaultCommand := resolveDefaultTerminalCommand(goos, shellEnv)
	return defaultCommand, req.Args
}

func resolveDefaultTerminalCommand(goos string, shellEnv string) string {
	if goos != "windows" {
		resolvedShell := strings.TrimSpace(shellEnv)
		if resolvedShell != "" {
			return resolvedShell
		}
	}

	if goos == "windows" {
		return "cmd.exe"
	}

	if goos == "darwin" {
		return "/bin/zsh"
	}

	return "/bin/bash"
}

func (m *TerminalManager) Send(req TerminalSendRequest) (TerminalSendResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalSendResponse{}, err
	}

	if !s.running.Load() {
		return TerminalSendResponse{}, NewRPCError(-32005, "terminal session not running")
	}

	n, err := io.WriteString(s.pty, req.Input)
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
	_ = s.pty.Close()
	s.closeSubscribers()

	m.mu.Lock()
	delete(m.sessions, s.id)
	m.mu.Unlock()

	return TerminalStopResponse{Stopped: true}, nil
}

func (m *TerminalManager) Resize(req TerminalResizeRequest) (TerminalResizeResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalResizeResponse{}, err
	}

	if req.Cols == 0 || req.Rows == 0 {
		return TerminalResizeResponse{}, NewRPCError(-32602, "cols and rows are required")
	}

	if err := pty.Setsize(s.pty, &pty.Winsize{Cols: req.Cols, Rows: req.Rows}); err != nil {
		return TerminalResizeResponse{}, err
	}

	return TerminalResizeResponse{Resized: true}, nil
}

func (m *TerminalManager) Subscribe(req TerminalSubscribeRequest) (TerminalSubscription, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalSubscription{}, err
	}

	id := m.nextSubID.Add(1)
	ch := make(chan TerminalEvent, 64)

	s.subsMu.Lock()
	s.subs[id] = ch
	s.subsMu.Unlock()

	return TerminalSubscription{ID: id, Events: ch}, nil
}

func (m *TerminalManager) Unsubscribe(req TerminalUnsubscribeRequest) (TerminalUnsubscribeResponse, error) {
	s, err := m.session(req.SessionID)
	if err != nil {
		return TerminalUnsubscribeResponse{}, err
	}

	s.subsMu.Lock()
	ch, ok := s.subs[req.SubscriptionID]
	if ok {
		delete(s.subs, req.SubscriptionID)
		close(ch)
	}
	s.subsMu.Unlock()

	if !ok {
		return TerminalUnsubscribeResponse{}, NewRPCError(-32004, "terminal subscription not found")
	}

	return TerminalUnsubscribeResponse{Unsubscribed: true}, nil
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

func (s *terminalSession) capture() {
	buf := make([]byte, 4096)
	for {
		n, err := s.pty.Read(buf)
		if n > 0 {
			chunk := string(buf[:n])
			s.outputMu.Lock()
			_, _ = s.output.WriteString(chunk)
			s.outputMu.Unlock()
			s.broadcast(TerminalEvent{SessionID: s.id, Type: "output", Chunk: chunk})
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			return
		}
	}
}

func (s *terminalSession) broadcast(event TerminalEvent) {
	s.subsMu.Lock()
	defer s.subsMu.Unlock()

	for _, ch := range s.subs {
		select {
		case ch <- event:
		default:
		}
	}
}

func (s *terminalSession) closeSubscribers() {
	s.subsMu.Lock()
	defer s.subsMu.Unlock()

	for id, ch := range s.subs {
		delete(s.subs, id)
		close(ch)
	}
}
