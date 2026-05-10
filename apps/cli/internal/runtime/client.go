package runtime

import (
	"fmt"
	"sync"
	"time"

	"yishan/apps/cli/internal/api"
	"yishan/apps/cli/internal/config"

	"github.com/spf13/viper"
)

var (
	mu     sync.RWMutex
	appCfg *config.Config
)

func Configure(cfg *config.Config) {
	mu.Lock()
	defer mu.Unlock()
	appCfg = cfg
}

func APIClient() *api.Client {
	mu.RLock()
	cfg := appCfg
	mu.RUnlock()
	if cfg == nil {
		return api.NewRuntimeClient(&config.Config{})
	}
	return api.NewRuntimeClient(cfg)
}

func APIConfigured() bool {
	mu.RLock()
	cfg := appCfg
	mu.RUnlock()
	return cfg != nil && cfg.API.BaseURL != "" && cfg.API.Token != ""
}

func PersistAuthTokens(update api.TokenUpdate) error {
	mu.Lock()
	defer mu.Unlock()

	if appCfg == nil || appCfg.ConfigPath == "" {
		return fmt.Errorf("runtime config is not initialized")
	}

	if shouldRejectStaleTokenUpdate(appCfg, update) {
		return nil
	}

	if err := config.UpdateFile(appCfg.ConfigPath, func(cfg *viper.Viper) {
		cfg.Set("api_base_url", appCfg.API.BaseURL)
		cfg.Set("api_token", update.AccessToken)
		if update.RefreshToken != "" {
			cfg.Set("api_refresh_token", update.RefreshToken)
		}
		if update.AccessTokenExpiresAt != "" {
			cfg.Set("api_access_token_expires_at", update.AccessTokenExpiresAt)
		}
		if update.RefreshTokenExpiresAt != "" {
			cfg.Set("api_refresh_token_expires_at", update.RefreshTokenExpiresAt)
		}
	}); err != nil {
		return fmt.Errorf("persist auth tokens: %w", err)
	}

	appCfg.API.Token = update.AccessToken
	if update.RefreshToken != "" {
		appCfg.API.RefreshToken = update.RefreshToken
	}
	if update.AccessTokenExpiresAt != "" {
		appCfg.API.AccessTokenExpiresAt = update.AccessTokenExpiresAt
	}
	if update.RefreshTokenExpiresAt != "" {
		appCfg.API.RefreshTokenExpiresAt = update.RefreshTokenExpiresAt
	}

	return nil
}

func shouldRejectStaleTokenUpdate(cfg *config.Config, incoming api.TokenUpdate) bool {
	currentRefreshExpiry, currentRefreshOK := parseExpiry(cfg.API.RefreshTokenExpiresAt)
	incomingRefreshExpiry, incomingRefreshOK := parseExpiry(incoming.RefreshTokenExpiresAt)
	if currentRefreshOK && incomingRefreshOK && incomingRefreshExpiry.Before(currentRefreshExpiry) {
		return true
	}

	currentAccessExpiry, currentAccessOK := parseExpiry(cfg.API.AccessTokenExpiresAt)
	incomingAccessExpiry, incomingAccessOK := parseExpiry(incoming.AccessTokenExpiresAt)
	if currentAccessOK && incomingAccessOK && incomingAccessExpiry.Before(currentAccessExpiry) {
		return true
	}

	return false
}

func parseExpiry(raw string) (time.Time, bool) {
	if raw == "" {
		return time.Time{}, false
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t, true
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, true
	}
	return time.Time{}, false
}
