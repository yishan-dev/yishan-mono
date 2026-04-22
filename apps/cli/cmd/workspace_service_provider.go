package cmd

import "yishan/apps/cli/internal/provision"

func workspaceProvisionService() *provision.Service {
	return provision.New(
		apiClient(),
		provision.DaemonAuthConfig{
			Host:        appConfig.Daemon.Host,
			Port:        appConfig.Daemon.Port,
			JWTSecret:   appConfig.Daemon.JWTSecret,
			JWTIssuer:   appConfig.Daemon.JWTIssuer,
			JWTAudience: appConfig.Daemon.JWTAudience,
			JWTRequired: appConfig.Daemon.JWTRequired,
		},
	)
}
