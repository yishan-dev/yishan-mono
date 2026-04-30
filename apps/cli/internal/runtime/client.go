package runtime

import (
	"sync"

	"yishan/apps/cli/internal/api"
	"yishan/apps/cli/internal/config"
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
