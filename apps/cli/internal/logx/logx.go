package logx

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	FormatPretty = "pretty"
	FormatJSON   = "json"
)

type Config struct {
	Level  string
	Format string
	Out    io.Writer
}

func Configure(cfg Config) error {
	level := strings.TrimSpace(strings.ToLower(cfg.Level))
	if level == "" {
		level = "info"
	}

	parsedLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		return fmt.Errorf("invalid log level %q: %w", cfg.Level, err)
	}

	format := strings.TrimSpace(strings.ToLower(cfg.Format))
	if format == "" {
		format = FormatPretty
	}
	if format != FormatPretty && format != FormatJSON {
		return fmt.Errorf("invalid log format %q: expected %q or %q", cfg.Format, FormatPretty, FormatJSON)
	}

	out := cfg.Out
	if out == nil {
		out = os.Stderr
	}

	zerolog.SetGlobalLevel(parsedLevel)
	zerolog.TimeFieldFormat = time.RFC3339

	if format == FormatJSON {
		log.Logger = zerolog.New(out).With().Timestamp().Logger()
		return nil
	}

	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: out, TimeFormat: time.RFC3339}).With().Timestamp().Logger()
	return nil
}
