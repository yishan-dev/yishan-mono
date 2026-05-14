package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	LogDirName  = "logs"
	LogFileName = "daemon.log"
)

// ResolveLogFilePath returns the default daemon log file path based on the
// config path. The log file is stored in a "logs" subdirectory next to the
// config file (e.g. ~/.yishan/profiles/<profile>/logs/daemon.log).
//
// If configPath is empty, falls back to $HOME/logs/daemon.log.
func ResolveLogFilePath(configPath string) (string, error) {
	if strings.TrimSpace(configPath) != "" {
		return filepath.Join(filepath.Dir(configPath), LogDirName, LogFileName), nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home dir: %w", err)
	}

	return filepath.Join(home, ".yishan", LogDirName, LogFileName), nil
}
