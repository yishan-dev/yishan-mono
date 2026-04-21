package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/workspace"
)

type request struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type response struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      any       `json:"id,omitempty"`
	Result  any       `json:"result,omitempty"`
	Error   *rpcError `json:"error,omitempty"`
}

type notification struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type JSONRPCHandler struct {
	upgrader websocket.Upgrader
	manager  *workspace.Manager
}

func NewJSONRPCHandler(manager *workspace.Manager) *JSONRPCHandler {
	return &JSONRPCHandler{
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
		manager: manager,
	}
}

func (h *JSONRPCHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}
	client := newWSClient(conn)
	defer client.Close()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Error().Err(err).Msg("websocket read failed")
			}
			return
		}

		resp := h.handleRequest(r.Context(), client, payload)
		if resp == nil {
			continue
		}

		if err := client.WriteJSON(resp); err != nil {
			log.Error().Err(err).Msg("websocket write failed")
			return
		}
	}
}

func (h *JSONRPCHandler) handleRequest(ctx context.Context, client *wsClient, payload []byte) *response {
	var req request
	if err := json.Unmarshal(payload, &req); err != nil {
		return &response{JSONRPC: "2.0", Error: &rpcError{Code: -32700, Message: "parse error"}}
	}

	if req.JSONRPC != "2.0" {
		return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Error: &rpcError{Code: -32600, Message: "invalid request"}}
	}

	result, err := h.dispatch(ctx, client, req.Method, req.Params)
	if err != nil {
		return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Error: mapRPCError(err)}
	}

	if len(req.ID) == 0 {
		return nil
	}

	return &response{JSONRPC: "2.0", ID: asJSONID(req.ID), Result: result}
}

func (h *JSONRPCHandler) dispatch(ctx context.Context, client *wsClient, method string, params json.RawMessage) (any, error) {
	switch method {
	case "daemon.ping":
		return map[string]string{"status": "ok"}, nil
	case "workspace.open":
		var req workspace.OpenRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.Open(req)
	case "workspace.list":
		return h.manager.List(), nil
	case "workspace.file.read":
		var req workspace.FileReadRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileRead(req)
	case "workspace.file.write":
		var req workspace.FileWriteRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileWrite(req)
	case "workspace.git.status":
		var req workspace.GitStatusRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitStatus(ctx, req)
	case "workspace.terminal.start":
		var req workspace.TerminalStartRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStart(ctx, req)
	case "workspace.terminal.send":
		var req workspace.TerminalSendRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalSend(req)
	case "workspace.terminal.read":
		var req workspace.TerminalReadRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalRead(req)
	case "workspace.terminal.stop":
		var req workspace.TerminalStopRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStop(req)
	case "workspace.terminal.resize":
		var req workspace.TerminalResizeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalResize(req)
	case "workspace.terminal.subscribe":
		var req workspace.TerminalSubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		subscription, err := h.manager.TerminalSubscribe(req)
		if err != nil {
			return nil, err
		}
		client.AttachSubscription(req.SessionID, subscription.ID, subscription.Events, func(sessionID string, subscriptionID uint64) {
			_, _ = h.manager.TerminalUnsubscribe(workspace.TerminalUnsubscribeRequest{SessionID: sessionID, SubscriptionID: subscriptionID})
		})
		return workspace.TerminalSubscribeResponse{Subscribed: true}, nil
	case "workspace.terminal.unsubscribe":
		var req workspace.TerminalUnsubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		client.DetachSubscription(req.SessionID)
		return workspace.TerminalUnsubscribeResponse{Unsubscribed: true}, nil
	default:
		return nil, workspace.NewRPCError(-32601, fmt.Sprintf("method not found: %s", method))
	}
}

type wsClient struct {
	conn          *websocket.Conn
	writeMu       sync.Mutex
	closeOnce     sync.Once
	subsMu        sync.Mutex
	subscriptions map[string]subscriptionHandle
}

type subscriptionHandle struct {
	sessionID      string
	subscriptionID uint64
	cancel         func(sessionID string, subscriptionID uint64)
}

func newWSClient(conn *websocket.Conn) *wsClient {
	return &wsClient{conn: conn, subscriptions: make(map[string]subscriptionHandle)}
}

func (c *wsClient) WriteJSON(v any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteJSON(v)
}

func (c *wsClient) Notify(method string, params any) error {
	return c.WriteJSON(notification{JSONRPC: "2.0", Method: method, Params: params})
}

func (c *wsClient) Close() {
	c.closeOnce.Do(func() {
		c.subsMu.Lock()
		handles := make([]subscriptionHandle, 0, len(c.subscriptions))
		for key, handle := range c.subscriptions {
			delete(c.subscriptions, key)
			handles = append(handles, handle)
		}
		c.subsMu.Unlock()

		for _, handle := range handles {
			handle.cancel(handle.sessionID, handle.subscriptionID)
		}
		_ = c.conn.Close()
	})
}

func (c *wsClient) AttachSubscription(sessionID string, subscriptionID uint64, events <-chan workspace.TerminalEvent, cancel func(sessionID string, subscriptionID uint64)) {
	c.subsMu.Lock()
	if current, ok := c.subscriptions[sessionID]; ok {
		delete(c.subscriptions, sessionID)
		current.cancel(current.sessionID, current.subscriptionID)
	}
	c.subscriptions[sessionID] = subscriptionHandle{sessionID: sessionID, subscriptionID: subscriptionID, cancel: cancel}
	c.subsMu.Unlock()

	go func() {
		for event := range events {
			switch event.Type {
			case "output":
				if err := c.Notify("workspace.terminal.output", map[string]any{
					"sessionId": event.SessionID,
					"chunk":     event.Chunk,
				}); err != nil {
					c.DetachSubscription(sessionID)
					return
				}
			case "exit":
				if err := c.Notify("workspace.terminal.exit", map[string]any{
					"sessionId": event.SessionID,
					"exitCode":  event.ExitCode,
				}); err != nil {
					c.DetachSubscription(sessionID)
					return
				}
			}
		}
	}()
}

func (c *wsClient) DetachSubscription(sessionID string) {
	c.subsMu.Lock()
	handle, ok := c.subscriptions[sessionID]
	if ok {
		delete(c.subscriptions, sessionID)
	}
	c.subsMu.Unlock()

	if ok {
		handle.cancel(handle.sessionID, handle.subscriptionID)
	}
}

func decodeParams(raw json.RawMessage, out any) error {
	if len(raw) == 0 {
		return workspace.NewRPCError(-32602, "missing params")
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return workspace.NewRPCError(-32602, "invalid params")
	}
	return nil
}

func asJSONID(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	var id any
	if err := json.Unmarshal(raw, &id); err != nil {
		return nil
	}
	return id
}

func mapRPCError(err error) *rpcError {
	var e *workspace.RPCError
	if errors.As(err, &e) {
		return &rpcError{Code: e.Code, Message: e.Message}
	}
	return &rpcError{Code: -32000, Message: err.Error()}
}
