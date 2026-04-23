package cmd

import (
	"errors"
	"net"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"yishan/apps/cli/internal/daemon"
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Run workspace daemon service",
	Long:  "Run the daemon in background mode and serve workspace operations over WebSocket JSON-RPC.",
	RunE:  runDaemon,
}

var daemonRunCmd = &cobra.Command{
	Use:   "run",
	Short: "Run workspace daemon service",
	RunE:  runDaemon,
}

var daemonStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop running daemon",
	RunE:  stopDaemon,
}

var daemonRestartCmd = &cobra.Command{
	Use:   "restart",
	Short: "Restart daemon in background",
	RunE:  restartDaemon,
}

func runDaemon(_ *cobra.Command, _ []string) error {
	statePath, err := daemon.ResolveStateFilePath(appConfig.ConfigPath)
	if err != nil {
		return err
	}

	return daemon.Run(daemon.RunConfig{
		Host:        appConfig.Daemon.Host,
		Port:        appConfig.Daemon.Port,
		JWTSecret:   appConfig.Daemon.JWTSecret,
		JWTIssuer:   appConfig.Daemon.JWTIssuer,
		JWTAudience: appConfig.Daemon.JWTAudience,
		JWTRequired: appConfig.Daemon.JWTRequired,
	}, statePath)
}

func stopDaemon(_ *cobra.Command, _ []string) error {
	statePath, err := daemon.ResolveStateFilePath(appConfig.ConfigPath)
	if err != nil {
		return err
	}

	state, err := daemon.Stop(statePath, 10*time.Second)
	if err != nil {
		if errors.Is(err, daemon.ErrNotRunning) {
			return errors.New("daemon is not running")
		}
		return err
	}

	log.Debug().Int("pid", state.PID).Msg("daemon stopped")
	return nil

}

func restartDaemon(_ *cobra.Command, _ []string) error {
	statePath, err := daemon.ResolveStateFilePath(appConfig.ConfigPath)
	if err != nil {
		return err
	}

	state, err := daemon.Restart(
		daemon.StartConfig{
			Run: daemon.RunConfig{
				Host:        appConfig.Daemon.Host,
				Port:        appConfig.Daemon.Port,
				JWTSecret:   appConfig.Daemon.JWTSecret,
				JWTIssuer:   appConfig.Daemon.JWTIssuer,
				JWTAudience: appConfig.Daemon.JWTAudience,
				JWTRequired: appConfig.Daemon.JWTRequired,
			},
			ConfigPath: cfgFile,
			LogLevel:   appConfig.LogLevel,
		},
		statePath,
		10*time.Second,
		5*time.Second,
	)
	if err != nil {
		return err
	}

	log.Debug().Int("pid", state.PID).Str("address", net.JoinHostPort(state.Host, strconv.Itoa(state.Port))).Msg("daemon restarted")
	return nil

}

func init() {
	rootCmd.AddCommand(daemonCmd)
	daemonCmd.AddCommand(daemonRunCmd)
	daemonCmd.AddCommand(daemonStopCmd)
	daemonCmd.AddCommand(daemonRestartCmd)

	daemonCmd.PersistentFlags().String("host", "127.0.0.1", "daemon listen host")
	daemonCmd.PersistentFlags().Int("port", 0, "daemon listen port (0 = random)")
	daemonCmd.PersistentFlags().String("jwt-secret", "", "JWT HMAC secret for daemon access")
	daemonCmd.PersistentFlags().String("jwt-issuer", "", "required JWT issuer")
	daemonCmd.PersistentFlags().String("jwt-audience", "", "required JWT audience")
	daemonCmd.PersistentFlags().Bool("jwt-required", true, "require JWT token for /ws access")

	cobra.CheckErr(viper.BindPFlag("daemon_host", daemonCmd.PersistentFlags().Lookup("host")))
	cobra.CheckErr(viper.BindPFlag("daemon_port", daemonCmd.PersistentFlags().Lookup("port")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_secret", daemonCmd.PersistentFlags().Lookup("jwt-secret")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_issuer", daemonCmd.PersistentFlags().Lookup("jwt-issuer")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_audience", daemonCmd.PersistentFlags().Lookup("jwt-audience")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_required", daemonCmd.PersistentFlags().Lookup("jwt-required")))
}
