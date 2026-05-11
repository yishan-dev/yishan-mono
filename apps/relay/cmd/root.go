package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"yishan/apps/relay/internal/auth"
	"yishan/apps/relay/internal/jobqueue"
	"yishan/apps/relay/internal/relay"
)

// Config holds all relay server configuration.
type Config struct {
	Host string
	Port int
	APIToken string

	JWTSecret   string
	JWTIssuer   string
	JWTAudience string

	// Job queue timeouts.
	JobAckTimeout    time.Duration
	JobResultTimeout time.Duration
	JobMaxRetries    int

	LogLevel string
}

func defaultConfig() Config {
	return Config{
		Host:             "0.0.0.0",
		Port:             8788,
		JWTIssuer:        "https://yishan.io",
		JWTAudience:      "api-service",
		JobAckTimeout:    30 * time.Second,
		JobResultTimeout: 5 * time.Minute,
		JobMaxRetries:    3,
		LogLevel:         "info",
	}
}

// Execute is the top-level entry point for the relay server.
func Execute() error {
	cfg := configFromEnv()

	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	if cfg.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.APIToken == "" {
		return fmt.Errorf("RELAY_API_TOKEN is required")
	}

	authenticator := auth.NewAuthenticator(auth.Config{
		Secret:   cfg.JWTSecret,
		Issuer:   cfg.JWTIssuer,
		Audience: cfg.JWTAudience,
	})

	sessions := relay.NewSessionManager()

	queue := jobqueue.NewManager(sessions, jobqueue.Config{
		AckTimeout:    cfg.JobAckTimeout,
		ResultTimeout: cfg.JobResultTimeout,
		MaxRetries:    cfg.JobMaxRetries,
	})

	srv := relay.NewServer(sessions, authenticator, queue, cfg.APIToken)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", srv.HandleWebSocket)
	mux.HandleFunc("/healthz", handleHealthz)
	mux.HandleFunc("/api/v1/dispatch", srv.HandleDispatch)
	mux.HandleFunc("/api/v1/runs/", srv.HandleRunStatus)
	mux.HandleFunc("/api/v1/metrics", srv.HandleMetrics)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	httpServer := &http.Server{Addr: addr, Handler: mux}

	// Graceful shutdown on SIGINT / SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		log.Info().Msg("shutting down relay server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()

	log.Info().Str("addr", addr).Msg("relay server starting")
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("listen: %w", err)
	}

	log.Info().Msg("relay server stopped")
	return nil
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func configFromEnv() Config {
	cfg := defaultConfig()

	if v := os.Getenv("HOST"); v != "" {
		cfg.Host = v
	}
	if v := os.Getenv("PORT"); v != "" {
		if _, err := fmt.Sscanf(v, "%d", &cfg.Port); err != nil {
			log.Warn().Str("PORT", v).Msg("invalid PORT, using default")
		}
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		cfg.JWTSecret = v
	}
	if v := os.Getenv("RELAY_API_TOKEN"); v != "" {
		cfg.APIToken = v
	}
	if v := os.Getenv("JWT_ISSUER"); v != "" {
		cfg.JWTIssuer = v
	}
	if v := os.Getenv("JWT_AUDIENCE"); v != "" {
		cfg.JWTAudience = v
	}
	if v := os.Getenv("JOB_ACK_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.JobAckTimeout = d
		}
	}
	if v := os.Getenv("JOB_RESULT_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.JobResultTimeout = d
		}
	}
	if v := os.Getenv("JOB_MAX_RETRIES"); v != "" {
		if _, err := fmt.Sscanf(v, "%d", &cfg.JobMaxRetries); err != nil {
			log.Warn().Str("JOB_MAX_RETRIES", v).Msg("invalid JOB_MAX_RETRIES, using default")
		}
	}
	if v := os.Getenv("LOG_LEVEL"); v != "" {
		cfg.LogLevel = v
	}

	return cfg
}
