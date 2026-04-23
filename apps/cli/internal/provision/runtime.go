package provision

import (
	"os"

	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/daemon"
)

type RuntimeConfig struct {
	ConfigPath string
	Daemon     DaemonAuthConfig
}

func NewForRuntime(apiClient rawClient, cfg RuntimeConfig) *Service {
	daemonAuth := cfg.Daemon

	statePath, err := daemon.ResolveStateFilePath(cfg.ConfigPath)
	if err != nil {
		log.Warn().Err(err).Msg("failed to resolve daemon runtime state path")
	} else if state, err := daemon.LoadState(statePath); err == nil {
		if daemon.IsProcessRunning(state.PID) {
			daemonAuth.Host = state.Host
			daemonAuth.Port = state.Port
		} else if err := daemon.RemoveState(statePath); err != nil {
			log.Warn().Err(err).Msg("failed to remove stale daemon state file")
		}
	} else if !os.IsNotExist(err) {
		log.Warn().Err(err).Msg("failed to load daemon runtime state")
	}

	return New(apiClient, daemonAuth)
}
