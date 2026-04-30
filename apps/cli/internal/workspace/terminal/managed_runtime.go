package terminal

import (
	"os"
	"path/filepath"
	"strings"
)

const managedRuntimeRootDirName = ".yishan"
const managedRuntimeOrigZdotdirEnvKey = "YISHAN_ORIG_ZDOTDIR"
const workspaceIDEnvKey = "YISHAN_WORKSPACE_ID"
const tabIDEnvKey = "YISHAN_TAB_ID"
const paneIDEnvKey = "YISHAN_PANE_ID"

func resolveManagedBashRcfilePath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, managedRuntimeRootDirName, "shell", "bash", "rcfile")
}

func resolveManagedRuntimeEnv(baseEnv []string, command string) []string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return baseEnv
	}
	managedRootDir := filepath.Join(homeDir, managedRuntimeRootDirName)
	managedBinDir := filepath.Join(managedRootDir, "bin")
	env := upsertEnv(baseEnv, "PATH", prependPathValue(envValueOrDefault(baseEnv, "PATH", os.Getenv("PATH")), managedBinDir))

	if filepath.Base(strings.TrimSpace(command)) == "zsh" {
		env = upsertEnv(env, managedRuntimeOrigZdotdirEnvKey, envValueOrDefault(env, "ZDOTDIR", envValueOrDefault(env, "HOME", homeDir)))
		env = upsertEnv(env, "ZDOTDIR", filepath.Join(managedRootDir, "shell", "zsh"))
	}
	return env
}

func resolveSessionMetadataEnv(baseEnv []string, req StartRequest) []string {
	env := baseEnv
	if strings.TrimSpace(req.WorkspaceID) != "" {
		env = upsertEnv(env, workspaceIDEnvKey, strings.TrimSpace(req.WorkspaceID))
	}
	if strings.TrimSpace(req.TabID) != "" {
		env = upsertEnv(env, tabIDEnvKey, strings.TrimSpace(req.TabID))
	}
	if strings.TrimSpace(req.PaneID) != "" {
		env = upsertEnv(env, paneIDEnvKey, strings.TrimSpace(req.PaneID))
	}
	return env
}

func prependPathValue(pathValue string, directory string) string {
	if strings.TrimSpace(directory) == "" {
		return pathValue
	}
	if strings.TrimSpace(pathValue) == "" {
		return directory
	}
	return directory + string(os.PathListSeparator) + pathValue
}
