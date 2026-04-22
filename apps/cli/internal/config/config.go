package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type APIConfig struct {
	BaseURL string
	Token   string
}

type DaemonConfig struct {
	Host        string
	Port        int
	JWTSecret   string
	JWTIssuer   string
	JWTAudience string
	JWTRequired bool
}

type Config struct {
	LogLevel     string
	ConfigPath   string
	CurrentOrgID string
	API          APIConfig
	Daemon       DaemonConfig
}

func Load(v *viper.Viper, explicitConfigPath string) (Config, error) {
	configPath, err := resolveConfigPath(v, explicitConfigPath)
	if err != nil {
		return Config{}, err
	}

	return Config{
		LogLevel:     v.GetString("log_level"),
		ConfigPath:   configPath,
		CurrentOrgID: v.GetString("current_org_id"),
		API: APIConfig{
			BaseURL: v.GetString("api_base_url"),
			Token:   v.GetString("api_token"),
		},
		Daemon: DaemonConfig{
			Host:        v.GetString("daemon_host"),
			Port:        v.GetInt("daemon_port"),
			JWTSecret:   v.GetString("daemon_jwt_secret"),
			JWTIssuer:   v.GetString("daemon_jwt_issuer"),
			JWTAudience: v.GetString("daemon_jwt_audience"),
			JWTRequired: v.GetBool("daemon_jwt_required"),
		},
	}, nil
}

func resolveConfigPath(v *viper.Viper, explicitConfigPath string) (string, error) {
	if used := v.ConfigFileUsed(); used != "" {
		return used, nil
	}
	if explicitConfigPath != "" {
		return explicitConfigPath, nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home dir: %w", err)
	}

	return home + "/.yishan.yaml", nil
}
