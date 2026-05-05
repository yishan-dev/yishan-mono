package daemon

import (
	"sync"

	"github.com/gorilla/websocket"
	"yishan/apps/cli/internal/workspace/terminal"
)

type wsConnState struct {
	conn          *websocket.Conn
	writeMu       sync.Mutex
	closeOnce     sync.Once
	subsMu        sync.Mutex
	subscriptions map[string]subscriptionHandle
	eventsMu      sync.Mutex
	eventsCancel  func()
}

type subscriptionHandle struct {
	sessionID      string
	subscriptionID uint64
	cancel         func(sessionID string, subscriptionID uint64)
}

func newWSConnState(conn *websocket.Conn) *wsConnState {
	return &wsConnState{conn: conn, subscriptions: make(map[string]subscriptionHandle)}
}

func (c *wsConnState) WriteJSON(v any) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteJSON(v)
}

// WriteBinary sends a binary WebSocket frame. Used for terminal I/O fast-path
// to avoid JSON marshal overhead on every PTY output chunk.
func (c *wsConnState) WriteBinary(data []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return c.conn.WriteMessage(websocket.BinaryMessage, data)
}

func (c *wsConnState) Notify(method string, params any) error {
	return c.WriteJSON(notification{JSONRPC: "2.0", Method: method, Params: params})
}

func (c *wsConnState) Close() {
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
		c.DetachEventStream()
		_ = c.conn.Close()
	})
}

func (c *wsConnState) AttachSubscription(sessionID string, subscriptionID uint64, events <-chan terminal.Event, cancel func(sessionID string, subscriptionID uint64)) {
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
				// Fast path: send PTY output as binary WebSocket frame.
				// Frame format: [0x02] [sessionID + '\0'] [raw PTY bytes]
				if len(event.RawChunk) > 0 {
					sid := []byte(event.SessionID)
					frame := make([]byte, 1+len(sid)+1+len(event.RawChunk))
					frame[0] = 0x02 // opcode: terminal output
					copy(frame[1:], sid)
					frame[1+len(sid)] = 0 // null terminator
					copy(frame[1+len(sid)+1:], event.RawChunk)
					if err := c.WriteBinary(frame); err != nil {
						c.DetachSubscription(sessionID)
						return
					}
				}
			case "exit":
				// Exit events remain as JSON-RPC — they are infrequent control messages.
				if err := c.Notify("terminal.exit", map[string]any{
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

func (c *wsConnState) DetachSubscription(sessionID string) {
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

func (c *wsConnState) AttachEventStream(events <-chan frontendEvent, cancel func()) {
	c.eventsMu.Lock()
	previousCancel := c.eventsCancel
	c.eventsCancel = cancel
	c.eventsMu.Unlock()

	if previousCancel != nil {
		previousCancel()
	}

	go func() {
		for event := range events {
			if err := c.Notify(MethodFrontendEventsStream, map[string]any{
				"topic":   event.Topic,
				"payload": event.Payload,
			}); err != nil {
				c.DetachEventStream()
				return
			}
		}
	}()
}

func (c *wsConnState) DetachEventStream() {
	c.eventsMu.Lock()
	cancel := c.eventsCancel
	c.eventsCancel = nil
	c.eventsMu.Unlock()

	if cancel != nil {
		cancel()
	}
}
