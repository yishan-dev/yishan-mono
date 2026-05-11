package relay

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"

	"yishan/apps/relay/internal/auth"
	"yishan/apps/relay/internal/jobqueue"
)

// Server is the relay WebSocket server.
type Server struct {
	sessions      *SessionManager
	authenticator *auth.Authenticator
	queue         *jobqueue.Manager
	apiToken      string
	upgrader      websocket.Upgrader
	startedAt     time.Time
}

// NewServer creates a new relay server.
func NewServer(sessions *SessionManager, authenticator *auth.Authenticator, queue *jobqueue.Manager, apiToken string) *Server {
	s := &Server{
		sessions:      sessions,
		authenticator: authenticator,
		queue:         queue,
		apiToken:      apiToken,
		upgrader: websocket.Upgrader{
			CheckOrigin:  func(_ *http.Request) bool { return true },
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
		},
		startedAt: time.Now(),
	}

	// Wire session events to the job queue for reconnect/disconnect handling.
	sessions.OnEvent(func(event SessionEvent) {
		switch event.Type {
		case "disconnected", "replaced":
			queue.HandleNodeDisconnect(event.NodeID)
		case "connected":
			queue.HandleNodeReconnect(event.NodeID)
		}
	})

	return s
}

// HandleWebSocket upgrades HTTP to WebSocket and runs the node session loop.
func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	identity, err := s.authenticator.Authenticate(r)
	if err != nil {
		log.Warn().Err(err).Msg("relay auth failed")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}

	session := s.sessions.Register(conn, *identity)
	defer func() {
		s.sessions.Disconnect(identity.NodeID, websocket.CloseNormalClosure, "connection closed")
	}()

	log.Info().
		Str("nodeId", identity.NodeID).
		Str("userId", identity.UserID).
		Msg("node relay session started")

	// Start heartbeat in background.
	done := make(chan struct{})
	defer close(done)
	go s.heartbeatLoop(session, done)

	s.readLoop(session)
}

// readLoop reads messages from the node's WebSocket until disconnection.
func (s *Server) readLoop(session *NodeSession) {
	nodeID := session.Identity.NodeID

	for {
		msgType, payload, err := session.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Str("nodeId", nodeID).Msg("websocket read failed")
			}
			return
		}

		if msgType != websocket.TextMessage {
			continue // Only handle text (JSON-RPC) frames.
		}

		go s.handleMessage(nodeID, payload)
	}
}

// handleMessage parses and dispatches a JSON-RPC message from a node.
func (s *Server) handleMessage(nodeID string, payload []byte) {
	var req request
	if err := json.Unmarshal(payload, &req); err != nil {
		log.Warn().Err(err).Str("nodeId", nodeID).Msg("invalid json from node")
		return
	}

	switch req.Method {
	case MethodPong:
		// Heartbeat pong — no action needed, the read itself proves liveness.
		log.Debug().Str("nodeId", nodeID).Msg("pong received")

	case MethodJobAck:
		var params jobAckParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			log.Warn().Err(err).Str("nodeId", nodeID).Msg("invalid job.ack params")
			return
		}
		s.queue.HandleAck(nodeID, jobqueue.AckParams{
			RunID:  params.RunID,
			Status: params.Status,
			Reason: params.Reason,
		})

	case MethodJobResult:
		var params jobResultParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			log.Warn().Err(err).Str("nodeId", nodeID).Msg("invalid job.result params")
			return
		}
		result := jobqueue.ResultParams{
			RunID:      params.RunID,
			Status:     params.Status,
			DurationMs: params.DurationMs,
		}
		if params.Output != nil {
			result.Output = params.Output
		}
		if params.Error != nil {
			result.Error = &jobqueue.ResultError{
				Code:    params.Error.Code,
				Message: params.Error.Message,
				Details: params.Error.Details,
			}
		}
		s.queue.HandleResult(nodeID, result)

	default:
		log.Debug().Str("nodeId", nodeID).Str("method", req.Method).Msg("unhandled method from node")
	}
}

// heartbeatLoop sends periodic relay.ping to the node.
func (s *Server) heartbeatLoop(session *NodeSession, done <-chan struct{}) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			if err := session.SendNotification(MethodPing, nil); err != nil {
				log.Debug().Err(err).Str("nodeId", session.Identity.NodeID).Msg("heartbeat ping failed")
				return
			}
		}
	}
}

// ---------------------------------------------------------------------------
// HTTP handlers for server-side dispatch and observability
// ---------------------------------------------------------------------------

// HandleDispatch handles POST /api/v1/dispatch — dispatches a job run to a node.
func (s *Server) HandleDispatch(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAPIRequest(w, r) {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		RunID        string         `json:"runId"`
		JobID        string         `json:"jobId"`
		NodeID       string         `json:"nodeId"`
		ScheduledFor string         `json:"scheduledFor"`
		Payload      map[string]any `json:"payload"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if body.RunID == "" || body.JobID == "" || body.NodeID == "" || body.ScheduledFor == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "runId, jobId, nodeId, and scheduledFor are required"})
		return
	}

	result := s.queue.Dispatch(jobqueue.DispatchParams{
		RunID:        body.RunID,
		JobID:        body.JobID,
		NodeID:       body.NodeID,
		ScheduledFor: body.ScheduledFor,
		Payload:      body.Payload,
	})

	switch {
	case result.OK:
		writeJSON(w, http.StatusAccepted, map[string]string{"runId": result.RunID, "status": "dispatched"})
	case result.Reason == "duplicate":
		writeJSON(w, http.StatusConflict, map[string]any{
			"error":         "duplicate dispatch",
			"existingRunId": result.ExistingRunID,
		})
	case result.Reason == "node_offline":
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error": "node offline",
			"runId": result.RunID,
			"status": "skipped_offline",
		})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]any{
			"error":  result.Reason,
			"detail": result.ErrorDetail,
		})
	}
}

// HandleRunStatus handles GET /api/v1/runs/{runId} — returns the status of a run.
func (s *Server) HandleRunStatus(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAPIRequest(w, r) {
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract runId from path: /api/v1/runs/{runId}
	runID := strings.TrimPrefix(r.URL.Path, "/api/v1/runs/")
	if runID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "runId is required"})
		return
	}

	run := s.queue.GetRun(runID)
	if run == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "run not found"})
		return
	}

	writeJSON(w, http.StatusOK, run)
}

// HandleMetrics handles GET /api/v1/metrics — returns relay and queue metrics.
func (s *Server) HandleMetrics(w http.ResponseWriter, r *http.Request) {
	if !s.authorizeAPIRequest(w, r) {
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	queueMetrics := s.queue.GetMetrics()

	metrics := map[string]any{
		"uptime":         time.Since(s.startedAt).String(),
		"connectedNodes": s.sessions.ConnectedNodeIDs(),
		"connectedCount": s.sessions.ConnectedCount(),
		"totalSessions":  s.sessions.TotalCount(),
		"queue":          queueMetrics,
	}

	writeJSON(w, http.StatusOK, metrics)
}

func (s *Server) authorizeAPIRequest(w http.ResponseWriter, r *http.Request) bool {
	authorization := r.Header.Get("Authorization")
	if authorization == "" {
		http.Error(w, "missing authorization", http.StatusUnauthorized)
		return false
	}

	token := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
	if token == "" || token == authorization || token != s.apiToken {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return false
	}

	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Error().Err(err).Msg("failed to write json response")
	}
}

// SendJobRun sends a job.run notification to a node via its relay session.
// Used by the job queue manager.
func (s *Server) SendJobRun(nodeID string, params jobRunParams) bool {
	return s.sessions.SendNotification(nodeID, MethodJobRun, params)
}

// FormatDispatchErr returns an actionable error message.
func FormatDispatchErr(nodeID string, err error) string {
	return fmt.Sprintf("failed to dispatch to node %s: %v — verify node is connected to relay and check relay logs for details", nodeID, err)
}
