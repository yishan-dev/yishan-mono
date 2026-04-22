package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

func updateConfigFile(update func(cfg *viper.Viper)) error {
	configPath := appConfig.ConfigPath
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

func resolveOrgID(cmd *cobra.Command) (string, error) {
	orgID, err := cmd.Flags().GetString("org-id")
	if err != nil {
		return "", err
	}
	if orgID != "" {
		return orgID, nil
	}
	if appConfig.CurrentOrgID != "" {
		return appConfig.CurrentOrgID, nil
	}

	return "", fmt.Errorf("no active org: run `yishan org use <org-id>` or pass --org-id")
}
