package runtime

import (
	"path/filepath"
	"testing"

	"github.com/spf13/viper"
	"yishan/apps/cli/internal/api"
	"yishan/apps/cli/internal/config"
)

func TestPersistAuthTokensRejectsStaleExpiryUpdate(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "credential.yaml")
	cfg := &config.Config{
		ConfigPath: configPath,
		API: config.APIConfig{
			BaseURL:               "https://api.yishan.io",
			Token:                 "current-access",
			RefreshToken:          "current-refresh",
			AccessTokenExpiresAt:  "2026-05-11T10:10:00Z",
			RefreshTokenExpiresAt: "2026-05-11T11:10:00Z",
		},
	}
	Configure(cfg)
	t.Cleanup(func() {
		Configure(nil)
	})

	if err := PersistAuthTokens(api.TokenUpdate{
		AccessToken:           cfg.API.Token,
		RefreshToken:          cfg.API.RefreshToken,
		AccessTokenExpiresAt:  cfg.API.AccessTokenExpiresAt,
		RefreshTokenExpiresAt: cfg.API.RefreshTokenExpiresAt,
	}); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	if err := PersistAuthTokens(api.TokenUpdate{
		AccessToken:           "stale-access",
		RefreshToken:          "stale-refresh",
		AccessTokenExpiresAt:  "2026-05-11T09:10:00Z",
		RefreshTokenExpiresAt: "2026-05-11T10:10:00Z",
	}); err != nil {
		t.Fatalf("persist stale update: %v", err)
	}

	if cfg.API.Token != "current-access" {
		t.Fatalf("expected in-memory token unchanged, got %q", cfg.API.Token)
	}
	if cfg.API.RefreshToken != "current-refresh" {
		t.Fatalf("expected in-memory refresh token unchanged, got %q", cfg.API.RefreshToken)
	}

	stored := loadConfigForTest(t, configPath)
	if got := stored.GetString("api_token"); got != "current-access" {
		t.Fatalf("expected persisted token unchanged, got %q", got)
	}
	if got := stored.GetString("api_refresh_token"); got != "current-refresh" {
		t.Fatalf("expected persisted refresh token unchanged, got %q", got)
	}
}

func TestPersistAuthTokensAcceptsNewerExpiryUpdate(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "credential.yaml")
	cfg := &config.Config{
		ConfigPath: configPath,
		API: config.APIConfig{
			BaseURL:               "https://api.yishan.io",
			Token:                 "old-access",
			RefreshToken:          "old-refresh",
			AccessTokenExpiresAt:  "2026-05-11T09:10:00Z",
			RefreshTokenExpiresAt: "2026-05-11T10:10:00Z",
		},
	}
	Configure(cfg)
	t.Cleanup(func() {
		Configure(nil)
	})

	if err := PersistAuthTokens(api.TokenUpdate{
		AccessToken:           "new-access",
		RefreshToken:          "new-refresh",
		AccessTokenExpiresAt:  "2026-05-11T10:10:00Z",
		RefreshTokenExpiresAt: "2026-05-11T11:10:00Z",
	}); err != nil {
		t.Fatalf("persist newer update: %v", err)
	}

	if cfg.API.Token != "new-access" {
		t.Fatalf("expected in-memory token to update, got %q", cfg.API.Token)
	}
	if cfg.API.RefreshToken != "new-refresh" {
		t.Fatalf("expected in-memory refresh token to update, got %q", cfg.API.RefreshToken)
	}

	stored := loadConfigForTest(t, configPath)
	if got := stored.GetString("api_token"); got != "new-access" {
		t.Fatalf("expected persisted token to update, got %q", got)
	}
	if got := stored.GetString("api_refresh_token"); got != "new-refresh" {
		t.Fatalf("expected persisted refresh token to update, got %q", got)
	}
}

func loadConfigForTest(t *testing.T, configPath string) *viper.Viper {
	t.Helper()
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")
	if err := v.ReadInConfig(); err != nil {
		t.Fatalf("read config %q: %v", configPath, err)
	}
	return v
}
