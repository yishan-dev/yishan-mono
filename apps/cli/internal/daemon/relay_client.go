package daemon

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	cliruntime "yishan/apps/cli/internal/runtime"
)

const relayReconnectInitialDelay = 2 * time.Second
const relayReconnectMaxDelay = 30 * time.Second

func runRelayClientLoop(handler *JSONRPCHandler, nodeID string, relayURL string) {
	endpoint, err := normalizeRelayWSURL(relayURL)
	if err != nil {
		log.Warn().Err(err).Str("relay_url", relayURL).Msg("invalid relay url; relay client disabled")
		return
	}

	delay := relayReconnectInitialDelay
	for {
		if !cliruntime.APIConfigured() {
			log.Warn().Msg("relay client waiting for API credentials")
			time.Sleep(delay)
			delay = nextRelayDelay(delay)
			continue
		}

		relayToken, err := mintRelayToken(nodeID)
		if err != nil {
			log.Warn().Err(err).Str("nodeId", nodeID).Msg("relay token mint failed")
			time.Sleep(delay)
			delay = nextRelayDelay(delay)
			continue
		}

		headers := http.Header{}
		headers.Set("Authorization", "Bearer "+relayToken)
		conn, _, err := websocket.DefaultDialer.Dial(endpoint, headers)
		if err != nil {
			log.Warn().Err(err).Str("relay_url", endpoint).Msg("relay websocket dial failed")
			time.Sleep(delay)
			delay = nextRelayDelay(delay)
			continue
		}

		log.Info().Str("relay_url", endpoint).Str("nodeId", nodeID).Msg("relay websocket connected")
		delay = relayReconnectInitialDelay

		runRelaySession(handler, conn)
	}
}

func runRelaySession(handler *JSONRPCHandler, conn *websocket.Conn) {
	connState := newWSConnState(conn)
	defer connState.Close()

	for {
		msgType, payload, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNormalClosure) {
				log.Warn().Err(err).Msg("relay websocket read failed")
			} else {
				log.Info().Err(err).Msg("relay websocket disconnected")
			}
			return
		}

		if msgType == websocket.BinaryMessage {
			handler.handleBinaryFrame(connState, payload)
			continue
		}

		resp := handler.handleRequest(context.Background(), connState, payload)
		if resp == nil {
			continue
		}
		if err := connState.WriteJSON(resp); err != nil {
			log.Warn().Err(err).Msg("relay websocket write failed")
			return
		}
	}
}

func normalizeRelayWSURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("empty relay url")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("parse relay url: %w", err)
	}

	switch parsed.Scheme {
	case "http":
		parsed.Scheme = "ws"
	case "https":
		parsed.Scheme = "wss"
	case "ws", "wss":
	default:
		return "", fmt.Errorf("unsupported relay url scheme %q", parsed.Scheme)
	}

	if parsed.Path == "" || parsed.Path == "/" {
		parsed.Path = "/ws"
	}

	return parsed.String(), nil
}

func mintRelayToken(nodeID string) (string, error) {
	client := cliruntime.APIClient()
	resp, err := client.RelayToken(nodeID)
	if err != nil {
		return "", fmt.Errorf("request relay token: %w", err)
	}
	if strings.TrimSpace(resp.Token) == "" {
		return "", fmt.Errorf("empty relay token in response")
	}
	return resp.Token, nil
}

func nextRelayDelay(current time.Duration) time.Duration {
	next := current * 2
	if next > relayReconnectMaxDelay {
		return relayReconnectMaxDelay
	}
	return next
}
