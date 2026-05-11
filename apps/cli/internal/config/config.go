package config

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/spf13/viper"
)

type APIConfig struct {
	BaseURL               string
	Token                 string
	RefreshToken          string
	AccessTokenExpiresAt  string
	RefreshTokenExpiresAt string
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
	LogFormat    string
	ConfigPath   string
	CurrentOrgID string
	RedisURL     string
	API          APIConfig
	Daemon       DaemonConfig
}

func ResolveConfigPath(v *viper.Viper, explicitConfigPath string) (string, error) {
	return resolveConfigPath(v, explicitConfigPath)
}

func Load(v *viper.Viper, explicitConfigPath string) (Config, error) {
	configPath, err := resolveConfigPath(v, explicitConfigPath)
	if err != nil {
		return Config{}, err
	}

	return Config{
		LogLevel:     v.GetString("log_level"),
		LogFormat:    v.GetString("log_format"),
		ConfigPath:   configPath,
		CurrentOrgID: v.GetString("current_org_id"),
		RedisURL:     v.GetString("redis_url"),
		API: APIConfig{
			BaseURL:               v.GetString("api_base_url"),
			Token:                 v.GetString("api_token"),
			RefreshToken:          v.GetString("api_refresh_token"),
			AccessTokenExpiresAt:  v.GetString("api_access_token_expires_at"),
			RefreshTokenExpiresAt: v.GetString("api_refresh_token_expires_at"),
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

	profile, err := resolveProfile(v)
	if err != nil {
		return "", err
	}

	configPath, err := defaultConfigPath(profile)
	if err != nil {
		return "", err
	}

	return configPath, nil
}

var profileNamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func resolveProfile(v *viper.Viper) (string, error) {
	raw := strings.TrimSpace(v.GetString("profile"))
	if raw == "" {
		return "default", nil
	}
	if !profileNamePattern.MatchString(raw) {
		return "", fmt.Errorf("invalid profile %q: use letters, numbers, dash, or underscore", raw)
	}

	return strings.ToLower(raw), nil
}

func defaultConfigPath(profile string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home dir: %w", err)
	}

	return filepath.Join(home, ".yishan", "profiles", profile, "credential.yaml"), nil
}

func DefaultConfigPathForProfile(profile string) (string, error) {
	if !profileNamePattern.MatchString(profile) {
		return "", fmt.Errorf("invalid profile %q: use letters, numbers, dash, or underscore", profile)
	}

	return defaultConfigPath(strings.ToLower(profile))
}
