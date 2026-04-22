package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

func UpdateFile(configPath string, update func(cfg *viper.Viper)) error {
	if err := os.MkdirAll(filepath.Dir(configPath), 0o755); err != nil {
		return fmt.Errorf("create config directory for %q: %w", configPath, err)
	}

	cfg := viper.New()
	cfg.SetConfigFile(configPath)
	cfg.SetConfigType("yaml")
	if _, err := os.Stat(configPath); err == nil {
		if err := cfg.ReadInConfig(); err != nil {
			return fmt.Errorf("read existing config file %q: %w", configPath, err)
		}
	}

	update(cfg)

	if _, err := os.Stat(configPath); err == nil {
		if err := cfg.WriteConfigAs(configPath); err != nil {
			return fmt.Errorf("write config file %q: %w", configPath, err)
		}
		return nil
	}

	if err := cfg.SafeWriteConfigAs(configPath); err != nil {
		return fmt.Errorf("create config file %q: %w", configPath, err)
	}

	return nil
}
