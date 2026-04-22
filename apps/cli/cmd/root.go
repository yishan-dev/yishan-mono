package cmd

import (
	"fmt"
	"os"
	"strings"
	"time"
	"yishan/apps/cli/internal/config"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "yishan",
	Short: "Yishan CLI",
	Long:  "Yishan CLI is a command-line tool for local developer workflows.",
	RunE: func(_ *cobra.Command, _ []string) error {
		log.Info().Str("log_level", zerolog.GlobalLevel().String()).Msg("yishan CLI is running")
		return nil
	},
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.yishan/profiles/<profile>/credential.yaml)")
	rootCmd.PersistentFlags().String("profile", "default", "runtime profile name (default, dev, ...)")
	rootCmd.PersistentFlags().String("log-level", "", "log level (debug, info, warn, error)")
	rootCmd.PersistentFlags().String("api-base-url", "http://localhost:8787", "API service base URL")
	rootCmd.PersistentFlags().String("api-token", "", "API access token (Bearer)")
	cobra.CheckErr(viper.BindPFlag("profile", rootCmd.PersistentFlags().Lookup("profile")))
	cobra.CheckErr(viper.BindPFlag("log_level", rootCmd.PersistentFlags().Lookup("log-level")))
	cobra.CheckErr(viper.BindPFlag("api_base_url", rootCmd.PersistentFlags().Lookup("api-base-url")))
	cobra.CheckErr(viper.BindPFlag("api_token", rootCmd.PersistentFlags().Lookup("api-token")))
}

func initConfig() {
	viper.SetEnvPrefix("YISHAN")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()
	viper.SetDefault("profile", "default")
	viper.SetDefault("log_level", "info")

	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		resolvedConfigPath, err := config.ResolveConfigPath(viper.GetViper(), cfgFile)
		cobra.CheckErr(err)
		viper.SetConfigFile(resolvedConfigPath)
	}

	if err := viper.ReadInConfig(); err == nil {
		log.Info().Str("file", viper.ConfigFileUsed()).Msg("using config file")
	} else if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
		cobra.CheckErr(err)
	}

	loaded, err := config.Load(viper.GetViper(), cfgFile)
	if err != nil {
		cobra.CheckErr(err)
	}
	appConfig = loaded

	if err := configureLogger(appConfig.LogLevel); err != nil {
		cobra.CheckErr(err)
	}
}

func configureLogger(level string) error {
	parsedLevel, err := zerolog.ParseLevel(level)
	if err != nil {
		return fmt.Errorf("invalid log level %q: %w", level, err)
	}

	zerolog.SetGlobalLevel(parsedLevel)
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339}).With().Timestamp().Logger()

	return nil
}
