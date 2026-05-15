package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestDoRawRefreshFailureReturnsRefreshError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/nodes/register":
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		case "/auth/refresh":
			http.Error(w, `{"error":"Invalid refresh token"}`, http.StatusUnauthorized)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	client := NewClient(server.URL, "expired-access", "stale-refresh", "", "", nil)
	_, err := client.DoRaw(http.MethodPost, "/nodes/register", map[string]string{"nodeId": "node-1"})
	if err == nil {
		t.Fatal("expected refresh failure error")
	}

	var refreshErr *TokenRefreshError
	if !errors.As(err, &refreshErr) {
		t.Fatalf("expected TokenRefreshError, got %T: %v", err, err)
	}
	if !strings.Contains(err.Error(), "token refresh failed") {
		t.Fatalf("expected refresh failure context, got %q", err.Error())
	}
	if refreshErr.RequestError == nil || refreshErr.RefreshError == nil {
		t.Fatalf("expected original and refresh errors to be preserved: %+v", refreshErr)
	}
}

func TestDoRawProactivelyRefreshesBeforeAccessTokenExpiry(t *testing.T) {
	var registerAttempts int
	var refreshAttempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/nodes/register":
			registerAttempts += 1
			if r.Header.Get("Authorization") == "Bearer fresh-access" {
				_, _ = w.Write([]byte(`{"ok":true}`))
				return
			}
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		case "/auth/refresh":
			refreshAttempts += 1
			_, _ = w.Write([]byte(`{"accessToken":"fresh-access","refreshToken":"next-refresh","accessTokenExpiresAt":"2030-01-01T00:10:00Z","refreshTokenExpiresAt":"2030-01-01T01:10:00Z"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	accessExp := time.Now().Add(10 * time.Second).UTC().Format(time.RFC3339)
	refreshExp := time.Now().Add(1 * time.Hour).UTC().Format(time.RFC3339)
	client := NewClient(server.URL, "expired-access", "valid-refresh", accessExp, refreshExp, nil)
	body, err := client.DoRaw(http.MethodPost, "/nodes/register", map[string]string{"nodeId": "node-1"})
	if err != nil {
		t.Fatalf("expected proactive refresh flow to succeed, got %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected response body: %s", string(body))
	}
	if refreshAttempts != 1 {
		t.Fatalf("expected one proactive refresh call, got %d", refreshAttempts)
	}
	if registerAttempts != 1 {
		t.Fatalf("expected single register request after proactive refresh, got %d", registerAttempts)
	}
}

func TestDoRawSkipsRefreshWhenRefreshTokenNearExpiry(t *testing.T) {
	var refreshAttempts int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/nodes/register":
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		case "/auth/refresh":
			refreshAttempts += 1
			http.Error(w, `{"error":"Invalid refresh token"}`, http.StatusUnauthorized)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	accessExp := time.Now().Add(10 * time.Second).UTC().Format(time.RFC3339)
	refreshExp := time.Now().Add(10 * time.Second).UTC().Format(time.RFC3339)
	client := NewClient(server.URL, "expired-access", "stale-refresh", accessExp, refreshExp, nil)
	_, err := client.DoRaw(http.MethodPost, "/nodes/register", map[string]string{"nodeId": "node-1"})
	if err == nil {
		t.Fatal("expected refresh guard error")
	}

	var refreshErr *TokenRefreshError
	if !errors.As(err, &refreshErr) {
		t.Fatalf("expected TokenRefreshError, got %T: %v", err, err)
	}
	if !strings.Contains(err.Error(), "token refresh failed") {
		t.Fatalf("expected token refresh context in error, got %q", err.Error())
	}
	if refreshAttempts != 0 {
		t.Fatalf("expected no refresh API call when refresh token near expiry, got %d", refreshAttempts)
	}
}

func TestDoRawRefreshSuccessRetriesOriginalRequest(t *testing.T) {
	var registerAttempts int
	var refreshed TokenUpdate
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/nodes/register":
			registerAttempts += 1
			if r.Header.Get("Authorization") == "Bearer fresh-access" {
				_, _ = w.Write([]byte(`{"ok":true}`))
				return
			}
			http.Error(w, `{"error":"Unauthorized"}`, http.StatusUnauthorized)
		case "/auth/refresh":
			var body map[string]string
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatalf("decode refresh body: %v", err)
			}
			if body["refreshToken"] != "valid-refresh" {
				t.Fatalf("expected valid refresh token, got %q", body["refreshToken"])
			}
			_, _ = w.Write([]byte(`{"accessToken":"fresh-access","refreshToken":"next-refresh","accessTokenExpiresAt":"access-exp","refreshTokenExpiresAt":"refresh-exp"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)

	client := NewClient(server.URL, "expired-access", "valid-refresh", "", "", func(update TokenUpdate) error {
		refreshed = update
		return nil
	})
	body, err := client.DoRaw(http.MethodPost, "/nodes/register", map[string]string{"nodeId": "node-1"})
	if err != nil {
		t.Fatalf("expected retry success, got %v", err)
	}
	if string(body) != `{"ok":true}` {
		t.Fatalf("unexpected response body: %s", string(body))
	}
	if registerAttempts != 2 {
		t.Fatalf("expected original request to be retried once, got %d attempts", registerAttempts)
	}
	if refreshed.AccessToken != "fresh-access" || refreshed.RefreshToken != "next-refresh" {
		t.Fatalf("expected refreshed tokens to be reported, got %+v", refreshed)
	}
}
