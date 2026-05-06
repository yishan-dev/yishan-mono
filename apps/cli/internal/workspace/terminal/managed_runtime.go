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
		managedZshDir := filepath.Join(managedRootDir, "shell", "zsh")
		// Resolve the user's real ZDOTDIR. If ZDOTDIR already points to
		// the managed wrapper directory (e.g. daemon inherited it from a
		// parent shell in dev mode), treat it as unset and fall back to
		// HOME to avoid a self-referential source loop in .zshenv.
		origZdotdir := resolveOrigZdotdir(env, managedZshDir, homeDir)
		env = upsertEnv(env, managedRuntimeOrigZdotdirEnvKey, origZdotdir)
		env = upsertEnv(env, "ZDOTDIR", managedZshDir)
	}
	return env
}

// resolveOrigZdotdir returns the user's real ZDOTDIR value. If the current
// ZDOTDIR points to the managed wrapper directory (which happens when the
// daemon process itself was launched from a managed shell, e.g. in dev mode),
// it is treated as unset and falls back to HOME.
func resolveOrigZdotdir(env []string, managedZshDir string, homeDir string) string {
	zdotdir := envValueOrDefault(env, "ZDOTDIR", "")
	if zdotdir == "" || zdotdir == managedZshDir {
		return envValueOrDefault(env, "HOME", homeDir)
	}
	return zdotdir
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
