package api

import (
	"fmt"

	"github.com/spf13/viper"
	"yishan/apps/cli/internal/config"
)

func NewRuntimeClient(appCfg *config.Config) *Client {
	return NewClient(
		appCfg.API.BaseURL,
		appCfg.API.Token,
		appCfg.API.RefreshToken,
		appCfg.API.AccessTokenExpiresAt,
		appCfg.API.RefreshTokenExpiresAt,
		func(update TokenUpdate) error {
			if err := config.UpdateFile(appCfg.ConfigPath, func(cfg *viper.Viper) {
				cfg.Set("api_base_url", appCfg.API.BaseURL)
				cfg.Set("api_token", update.AccessToken)
				cfg.Set("api_refresh_token", update.RefreshToken)
				cfg.Set("api_access_token_expires_at", update.AccessTokenExpiresAt)
				cfg.Set("api_refresh_token_expires_at", update.RefreshTokenExpiresAt)
			}); err != nil {
				return fmt.Errorf("persist refreshed API tokens: %w", err)
			}

			appCfg.API.Token = update.AccessToken
			appCfg.API.RefreshToken = update.RefreshToken
			appCfg.API.AccessTokenExpiresAt = update.AccessTokenExpiresAt
			appCfg.API.RefreshTokenExpiresAt = update.RefreshTokenExpiresAt
			return nil
		},
	)
}
