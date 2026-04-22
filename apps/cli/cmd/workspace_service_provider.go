package cmd

import (
	"os"

	"github.com/rs/zerolog/log"
	"yishan/apps/cli/internal/daemonctl"
	"yishan/apps/cli/internal/provision"
)

func workspaceProvisionService() *provision.Service {
	daemonHost := appConfig.Daemon.Host
	daemonPort := appConfig.Daemon.Port

	statePath, err := daemonctl.ResolveStateFilePath(appConfig.ConfigPath)
	if err != nil {
		log.Warn().Err(err).Msg("failed to resolve daemon runtime state path")
	} else if state, err := daemonctl.LoadState(statePath); err == nil {
		if daemonctl.IsProcessRunning(state.PID) {
			daemonHost = state.Host
			daemonPort = state.Port
		} else if err := daemonctl.RemoveState(statePath); err != nil {
			log.Warn().Err(err).Msg("failed to remove stale daemon state file")
		}
	} else if !os.IsNotExist(err) {
		log.Warn().Err(err).Msg("failed to load daemon runtime state")
	}

	return provision.New(
		apiClient(),
		provision.DaemonAuthConfig{
			Host:        daemonHost,
			Port:        daemonPort,
			JWTSecret:   appConfig.Daemon.JWTSecret,
			JWTIssuer:   appConfig.Daemon.JWTIssuer,
			JWTAudience: appConfig.Daemon.JWTAudience,
			JWTRequired: appConfig.Daemon.JWTRequired,
		},
	)
}
