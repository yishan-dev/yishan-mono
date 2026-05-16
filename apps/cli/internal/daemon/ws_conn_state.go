package daemon

import (
	"sync"

	"github.com/gorilla/websocket"
	"yishan/apps/cli/internal/workspace/terminal"
)

const maxTerminalPendingBytes = 64 * 1024

type wsConnState struct {
	conn                            *websocket.Conn
	writeMu                         sync.Mutex
	closeOnce                       sync.Once
	subsMu                          sync.Mutex
	subscriptions                   map[string]subscriptionHandle
	eventsMu                        sync.Mutex
	eventsCancel                    func()
	lastTerminalInputSessionID      string
	lastTerminalInputSessionIDBytes []byte
}

type subscriptionHandle struct {
	sessionID      string
	subscriptionID uint64
	cancel         func(sessionID string, subscriptionID uint64)
}

func newWSConnState(conn *websocket.Conn) *wsConnState {
	return &wsConnState{conn: conn, subscriptions: make(map[string]subscriptionHandle)}
}

func (c *wsConnState) terminalInputSessionID(raw []byte) string {
	if stringBytesEqual(raw, c.lastTerminalInputSessionIDBytes) {
		return c.lastTerminalInputSessionID
	}

	c.lastTerminalInputSessionID = string(raw)
	c.lastTerminalInputSessionIDBytes = append(c.lastTerminalInputSessionIDBytes[:0], raw...)
	return c.lastTerminalInputSessionID
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

// tryWriteBinary attempts a non-blocking binary write. Returns true if the
// frame was sent; returns false if the write mutex is held by another
// goroutine (backpressure — the caller should buffer and retry later).
func (c *wsConnState) tryWriteBinary(data []byte) bool {
	if !c.writeMu.TryLock() {
		return false
	}
	err := c.conn.WriteMessage(websocket.BinaryMessage, data)
	c.writeMu.Unlock()
	return err == nil
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
		sid := []byte(sessionID)
		outputFramePrefix := make([]byte, 1+len(sid)+1)
		outputFramePrefix[0] = 0x02 // opcode: terminal output
		copy(outputFramePrefix[1:], sid)
		outputFramePrefix[1+len(sid)] = 0 // null terminator

		// Per-session pending buffer: accumulates output chunks that couldn't be
		// written immediately because the WebSocket write mutex was held by another
		// terminal's goroutine. Coalesced into the next successful write to avoid
		// cascading blockage when one terminal saturates the shared WebSocket.
		var pending []byte

		flushPending := func(rawChunk []byte) {
			// Build the full payload: any pending bytes + the new chunk.
			payloadLen := len(pending) + len(rawChunk)
			if payloadLen == 0 {
				return
			}

			frame := make([]byte, len(outputFramePrefix)+payloadLen)
			copy(frame, outputFramePrefix)
			writePos := len(outputFramePrefix)
			if len(pending) > 0 {
				copy(frame[writePos:], pending)
				writePos += len(pending)
			}
			copy(frame[writePos:], rawChunk)

			if c.tryWriteBinary(frame) {
				pending = pending[:0]
			} else {
				// Mutex held — accumulate into pending buffer (capped).
				avail := maxTerminalPendingBytes - len(pending)
				if avail >= len(rawChunk) {
					pending = append(pending, rawChunk...)
				} else if avail > 0 {
					pending = append(pending, rawChunk[:avail]...)
				}
			}
		}

		for event := range events {
			switch event.Type {
			case "output":
				flushPending(event.RawChunk)
			case "exit":
				// Exit events are infrequent and critical — use blocking write.
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

func stringBytesEqual(value []byte, candidate []byte) bool {
	if len(value) != len(candidate) {
		return false
	}
	for index := range value {
		if value[index] != candidate[index] {
			return false
		}
	}
	return true
}
