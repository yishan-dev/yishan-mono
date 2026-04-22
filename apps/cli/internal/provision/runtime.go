package provision

import (
	"os"

	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/daemonctl"
)

type RuntimeConfig struct {
	ConfigPath string
	Daemon     DaemonAuthConfig
}

func NewForRuntime(apiClient rawClient, cfg RuntimeConfig) *Service {
	daemonAuth := cfg.Daemon

	statePath, err := daemonctl.ResolveStateFilePath(cfg.ConfigPath)
	if err != nil {
		log.Warn().Err(err).Msg("failed to resolve daemon runtime state path")
	} else if state, err := daemonctl.LoadState(statePath); err == nil {
		if daemonctl.IsProcessRunning(state.PID) {
			daemonAuth.Host = state.Host
			daemonAuth.Port = state.Port
		} else if err := daemonctl.RemoveState(statePath); err != nil {
			log.Warn().Err(err).Msg("failed to remove stale daemon state file")
		}
	} else if !os.IsNotExist(err) {
		log.Warn().Err(err).Msg("failed to load daemon runtime state")
	}

	return New(apiClient, daemonAuth)
}
