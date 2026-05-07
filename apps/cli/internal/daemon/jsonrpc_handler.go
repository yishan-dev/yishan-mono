package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/workspace"
)

const (
	// Binary frame opcodes for terminal I/O fast-path.
	binOpcodeTerminalInput  byte = 0x01
	binOpcodeTerminalOutput byte = 0x02
)

type JSONRPCHandler struct {
	upgrader websocket.Upgrader
	manager  *workspace.Manager
	nodeID   string
	events   *eventHub
	watchers *workspaceWatchers
}

func NewJSONRPCHandler(manager *workspace.Manager, nodeID string) *JSONRPCHandler {
	events := newEventHub()
	return &JSONRPCHandler{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
		manager:  manager,
		nodeID:   nodeID,
		events:   events,
		watchers: newWorkspaceWatchers(events),
	}
}

func (h *JSONRPCHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}
	connState := newWSConnState(conn)
	defer connState.Close()

	for {
		msgType, payload, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Msg("websocket read failed")
			}
			return
		}

		// Binary frames are terminal I/O fast-path — skip JSON-RPC entirely.
		if msgType == websocket.BinaryMessage {
			h.handleBinaryFrame(connState, payload)
			continue
		}

		resp := h.handleRequest(r.Context(), connState, payload)
		if resp == nil {
			continue
		}

		if err := connState.WriteJSON(resp); err != nil {
			log.Error().Err(err).Msg("websocket write failed")
			return
		}
	}
}

// handleBinaryFrame processes a binary WebSocket frame for terminal I/O.
// Frame format: [1 byte opcode] [session ID (null-terminated)] [payload]
func (h *JSONRPCHandler) handleBinaryFrame(connState *wsConnState, payload []byte) {
	if len(payload) < 3 { // minimum: opcode + at least 1 char session ID + null terminator
		return
	}

	opcode := payload[0]
	rest := payload[1:]

	switch opcode {
	case binOpcodeTerminalInput:
		// Find the null-terminated session ID.
		nullIdx := bytes.IndexByte(rest, 0)
		if nullIdx < 0 {
			return
		}
		sessionID := connState.terminalInputSessionID(rest[:nullIdx])
		inputData := rest[nullIdx+1:]
		if len(inputData) == 0 {
			return
		}
		// Write raw bytes directly to PTY — avoids JSON unmarshal + string conversion.
		h.manager.TerminalSendRaw(sessionID, inputData)
	}
}

func (h *JSONRPCHandler) handleRequest(ctx context.Context, connState *wsConnState, payload []byte) *response {
	var req request
	if err := json.Unmarshal(payload, &req); err != nil {
		return &response{JSONRPC: "2.0", Error: &rpcError{Code: -32700, Message: "parse error"}}
	}

	if req.JSONRPC != "2.0" {
		return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Error: &rpcError{Code: -32600, Message: "invalid request"}}
	}

	result, err := h.dispatch(ctx, connState, req.Method, req.Params)
	if err != nil {
		return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Error: mapRPCError(err)}
	}

	if len(req.ID) == 0 {
		return nil
	}

	return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Result: result}
}
