package cmd

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"yishan/apps/cli/internal/daemon"
	"yishan/apps/cli/internal/workspace"
)

var daemonCmd = &cobra.Command{
	Use:   "daemon",
	Short: "Run workspace daemon service",
	Long:  "Run the daemon in background mode and serve workspace operations over WebSocket JSON-RPC.",
	RunE: func(_ *cobra.Command, _ []string) error {
		host := viper.GetString("daemon_host")
		port := viper.GetInt("daemon_port")
		jwtSecret := viper.GetString("daemon_jwt_secret")
		jwtIssuer := viper.GetString("daemon_jwt_issuer")
		jwtAudience := viper.GetString("daemon_jwt_audience")
		jwtRequired := viper.GetBool("daemon_jwt_required")
		addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))

		workspaceManager := workspace.NewManager()
		handler := daemon.NewJSONRPCHandler(workspaceManager)
		auth := daemon.NewJWTAuth(daemon.JWTAuthConfig{
			Secret:   jwtSecret,
			Issuer:   jwtIssuer,
			Audience: jwtAudience,
			Required: jwtRequired,
		})
		if err := auth.ValidateConfig(); err != nil {
			return err
		}

		mux := http.NewServeMux()
		mux.Handle("/ws", auth.Middleware(handler))
		mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		})

		server := &http.Server{
			Addr:              addr,
			Handler:           mux,
			ReadHeaderTimeout: 5 * time.Second,
		}

		stop := make(chan os.Signal, 1)
		signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

		go func() {
			<-stop
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			if err := server.Shutdown(ctx); err != nil {
				log.Error().Err(err).Msg("failed to shutdown daemon server")
			}
		}()

		log.Info().Str("address", addr).Bool("jwt_required", jwtRequired).Msg("daemon server started")
		err := server.ListenAndServe()
		if err != nil && err != http.ErrServerClosed {
			return fmt.Errorf("daemon server failed: %w", err)
		}

		log.Info().Msg("daemon server stopped")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(daemonCmd)

	daemonCmd.Flags().String("host", "127.0.0.1", "daemon listen host")
	daemonCmd.Flags().Int("port", 7788, "daemon listen port")
	daemonCmd.Flags().String("jwt-secret", "", "JWT HMAC secret for daemon access")
	daemonCmd.Flags().String("jwt-issuer", "", "required JWT issuer")
	daemonCmd.Flags().String("jwt-audience", "", "required JWT audience")
	daemonCmd.Flags().Bool("jwt-required", true, "require JWT token for /ws access")

	cobra.CheckErr(viper.BindPFlag("daemon_host", daemonCmd.Flags().Lookup("host")))
	cobra.CheckErr(viper.BindPFlag("daemon_port", daemonCmd.Flags().Lookup("port")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_secret", daemonCmd.Flags().Lookup("jwt-secret")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_issuer", daemonCmd.Flags().Lookup("jwt-issuer")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_audience", daemonCmd.Flags().Lookup("jwt-audience")))
	cobra.CheckErr(viper.BindPFlag("daemon_jwt_required", daemonCmd.Flags().Lookup("jwt-required")))
}
