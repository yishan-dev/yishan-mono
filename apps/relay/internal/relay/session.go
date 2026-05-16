package relay

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"yishan/apps/relay/internal/auth"
)

// ---------------------------------------------------------------------------
// NodeSession represents a single connected node.
// ---------------------------------------------------------------------------

// SessionState is the connection state of a node session.
type SessionState string

const (
	StateConnected    SessionState = "connected"
	StateDisconnected SessionState = "disconnected"
)

// NodeSession holds the state for a connected (or recently disconnected) node.
type NodeSession struct {
	Identity       auth.NodeIdentity
	State          SessionState
	ConnectedAt    time.Time
	DisconnectedAt *time.Time

	conn    *websocket.Conn
	writeMu sync.Mutex
}

func newNodeSession(conn *websocket.Conn, identity auth.NodeIdentity) *NodeSession {
	return &NodeSession{
		Identity:    identity,
		State:       StateConnected,
		ConnectedAt: time.Now(),
		conn:        conn,
	}
}

// SendJSON sends a JSON message to the node. Thread-safe.
func (s *NodeSession) SendJSON(v any) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if s.conn == nil {
		return ErrNodeOffline
	}
	return s.conn.WriteJSON(v)
}

// SendNotification sends a JSON-RPC notification to the node.
func (s *NodeSession) SendNotification(method string, params any) error {
	return s.SendJSON(notification{JSONRPC: "2.0", Method: method, Params: params})
}

// SendMessage sends a raw WebSocket message to the node. Thread-safe.
func (s *NodeSession) SendMessage(msgType int, payload []byte) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if s.conn == nil {
		return ErrNodeOffline
	}
	return s.conn.WriteMessage(msgType, payload)
}

// Close terminates the underlying WebSocket connection.
func (s *NodeSession) Close(code int, reason string) {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	if s.conn != nil {
		_ = s.conn.WriteMessage(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(code, reason),
		)
		_ = s.conn.Close()
		s.conn = nil
	}
}

func (s *NodeSession) markDisconnected() {
	now := time.Now()
	s.State = StateDisconnected
	s.DisconnectedAt = &now
	s.writeMu.Lock()
	s.conn = nil
	s.writeMu.Unlock()
}

// ---------------------------------------------------------------------------
// Session events
// ---------------------------------------------------------------------------

// SessionEvent represents a lifecycle event for a node session.
type SessionEvent struct {
	Type          string // "connected", "disconnected", "replaced"
	NodeID        string
	UserID        string
	DaemonVersion string
}

type ConnectedSessionView struct {
	NodeID        string  `json:"nodeId"`
	UserID        string  `json:"userId"`
	DaemonVersion *string `json:"daemonVersion,omitempty"`
}

// SessionEventHandler is a callback for session lifecycle events.
type SessionEventHandler func(SessionEvent)

// ---------------------------------------------------------------------------
// SessionManager tracks all node sessions.
// ---------------------------------------------------------------------------

// SessionManager manages the lifecycle of node WebSocket sessions.
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*NodeSession // keyed by nodeId
	handlers []SessionEventHandler
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*NodeSession),
	}
}

// OnEvent registers a handler for session lifecycle events.
func (m *SessionManager) OnEvent(handler SessionEventHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers = append(m.handlers, handler)
}

func (m *SessionManager) emit(event SessionEvent) {
	// Read handlers under lock, call outside lock to avoid deadlock.
	m.mu.RLock()
	handlers := make([]SessionEventHandler, len(m.handlers))
	copy(handlers, m.handlers)
	m.mu.RUnlock()

	for _, h := range handlers {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Error().Interface("panic", r).Msg("session event handler panic")
				}
			}()
			h(event)
		}()
	}
}

// Register creates or replaces a session for the given node.
// If the node already has an active connection, the old one is closed.
func (m *SessionManager) Register(conn *websocket.Conn, identity auth.NodeIdentity) *NodeSession {
	m.mu.Lock()
	existing := m.sessions[identity.NodeID]
	session := newNodeSession(conn, identity)
	m.sessions[identity.NodeID] = session
	m.mu.Unlock()

	if existing != nil && existing.State == StateConnected {
		log.Info().Str("nodeId", identity.NodeID).Msg("replacing existing connection")
		existing.Close(4000, "replaced by new connection")
		existing.markDisconnected()
		m.emit(SessionEvent{Type: "replaced", NodeID: identity.NodeID, UserID: identity.UserID, DaemonVersion: identity.DaemonVersion})
	}

	log.Info().
		Str("nodeId", identity.NodeID).
		Str("userId", identity.UserID).
		Msg("node connected")
	m.emit(SessionEvent{Type: "connected", NodeID: identity.NodeID, UserID: identity.UserID, DaemonVersion: identity.DaemonVersion})
	return session
}

// Disconnect marks a node session as disconnected.
func (m *SessionManager) Disconnect(nodeID string, code int, reason string) {
	m.mu.Lock()
	session := m.sessions[nodeID]
	m.mu.Unlock()

	if session == nil {
		return
	}

	session.markDisconnected()
	log.Info().
		Str("nodeId", nodeID).
		Int("code", code).
		Str("reason", reason).
		Msg("node disconnected")
	m.emit(SessionEvent{Type: "disconnected", NodeID: nodeID, UserID: session.Identity.UserID, DaemonVersion: session.Identity.DaemonVersion})
}

// Get returns a session by node ID, or nil if not found.
func (m *SessionManager) Get(nodeID string) *NodeSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[nodeID]
}

// IsOnline checks if a node is currently connected.
func (m *SessionManager) IsOnline(nodeID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s := m.sessions[nodeID]
	return s != nil && s.State == StateConnected
}

// ConnectedNodeIDs returns the IDs of all currently connected nodes.
func (m *SessionManager) ConnectedNodeIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := make([]string, 0, len(m.sessions))
	for id, s := range m.sessions {
		if s.State == StateConnected {
			ids = append(ids, id)
		}
	}
	return ids
}

// ConnectedSessions returns the connected node sessions with live identity metadata.
func (m *SessionManager) ConnectedSessions() []ConnectedSessionView {
	m.mu.RLock()
	defer m.mu.RUnlock()
	sessions := make([]ConnectedSessionView, 0, len(m.sessions))
	for _, s := range m.sessions {
		if s.State != StateConnected {
			continue
		}
		view := ConnectedSessionView{
			NodeID: s.Identity.NodeID,
			UserID: s.Identity.UserID,
		}
		if s.Identity.DaemonVersion != "" {
			version := s.Identity.DaemonVersion
			view.DaemonVersion = &version
		}
		sessions = append(sessions, view)
	}
	return sessions
}

// ConnectedCount returns the number of currently connected nodes.
func (m *SessionManager) ConnectedCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	count := 0
	for _, s := range m.sessions {
		if s.State == StateConnected {
			count++
		}
	}
	return count
}

// TotalCount returns the total number of tracked sessions.
func (m *SessionManager) TotalCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.sessions)
}

// SendNotification sends a JSON-RPC notification to a specific node.
// Returns false if the node is not online.
func (m *SessionManager) SendNotification(nodeID, method string, params any) bool {
	m.mu.RLock()
	session := m.sessions[nodeID]
	m.mu.RUnlock()

	if session == nil || session.State != StateConnected {
		return false
	}

	if err := session.SendNotification(method, params); err != nil {
		log.Error().Err(err).Str("nodeId", nodeID).Str("method", method).Msg("send notification failed")
		return false
	}
	return true
}
