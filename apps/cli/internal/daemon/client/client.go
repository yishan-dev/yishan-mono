package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/websocket"
)

type Client struct {
	url   string
	token string
}

type request struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func New(url string, token string) *Client {
	return &Client{url: url, token: token}
}

func (c *Client) Call(ctx context.Context, method string, params any, out any) error {
	headers := http.Header{}
	if c.token != "" {
		headers.Set("Authorization", "Bearer "+c.token)
	}

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, c.url, headers)
	if err != nil {
		return fmt.Errorf("connect daemon websocket: %w", err)
	}
	defer conn.Close()

	if err := conn.WriteJSON(request{JSONRPC: "2.0", ID: 1, Method: method, Params: params}); err != nil {
		return fmt.Errorf("send daemon RPC request: %w", err)
	}

	_, payload, err := conn.ReadMessage()
	if err != nil {
		return fmt.Errorf("read daemon RPC response: %w", err)
	}

	var res response
	if err := json.Unmarshal(payload, &res); err != nil {
		return fmt.Errorf("parse daemon RPC response: %w", err)
	}
	if res.Error != nil {
		return fmt.Errorf("daemon RPC error %d: %s", res.Error.Code, res.Error.Message)
	}

	if out == nil || len(res.Result) == 0 {
		return nil
	}

	if err := json.Unmarshal(res.Result, out); err != nil {
		return fmt.Errorf("decode daemon RPC result: %w", err)
	}

	return nil
}
