package shellenv

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

const ManagedRuntimeRootDirName = ".yishan"
const ManagedRuntimeOrigZdotdirEnvKey = "YISHAN_ORIG_ZDOTDIR"

func ResolveUserShell(shellEnv string) string {
	if resolved := strings.TrimSpace(shellEnv); resolved != "" {
		return resolved
	}

	if runtime.GOOS == "windows" {
		return "cmd.exe"
	}

	if runtime.GOOS == "darwin" {
		return "/bin/zsh"
	}

	for _, candidate := range []string{"/bin/bash", "/bin/sh"} {
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}

	return "/bin/sh"
}

func EnvValueOrDefault(env []string, key string, fallback string) string {
	prefix := key + "="
	for _, entry := range env {
		if strings.HasPrefix(entry, prefix) && strings.TrimSpace(strings.TrimPrefix(entry, prefix)) != "" {
			return strings.TrimPrefix(entry, prefix)
		}
	}
	return fallback
}

func UpsertEnv(env []string, key string, value string) []string {
	prefix := key + "="
	for index, entry := range env {
		if strings.HasPrefix(entry, prefix) {
			env[index] = prefix + value
			return env
		}
	}
	return append(env, prefix+value)
}

func PrependPathValue(pathValue string, directory string) string {
	if strings.TrimSpace(directory) == "" {
		return pathValue
	}
	if strings.TrimSpace(pathValue) == "" {
		return directory
	}
	return directory + string(os.PathListSeparator) + pathValue
}

func ResolveManagedRuntimeEnv(baseEnv []string, command string) []string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return baseEnv
	}
	managedRootDir := filepath.Join(homeDir, ManagedRuntimeRootDirName)
	managedBinDir := filepath.Join(managedRootDir, "bin")
	env := UpsertEnv(baseEnv, "PATH", PrependPathValue(EnvValueOrDefault(baseEnv, "PATH", os.Getenv("PATH")), managedBinDir))

	if filepath.Base(strings.TrimSpace(command)) == "zsh" {
		managedZshDir := filepath.Join(managedRootDir, "shell", "zsh")
		origZdotdir := resolveOrigZdotdir(env, managedZshDir, homeDir)
		env = UpsertEnv(env, ManagedRuntimeOrigZdotdirEnvKey, origZdotdir)
		env = UpsertEnv(env, "ZDOTDIR", managedZshDir)
	}
	return env
}

func EnsurePathHasExistingDirectories(env []string, directories []string) []string {
	currentPath := EnvValueOrDefault(env, "PATH", "")
	pathDirs := strings.Split(currentPath, string(os.PathListSeparator))
	pathSet := make(map[string]bool, len(pathDirs))
	for _, d := range pathDirs {
		pathSet[d] = true
	}

	var toAppend []string
	for _, dir := range directories {
		if strings.TrimSpace(dir) == "" || pathSet[dir] {
			continue
		}
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			toAppend = append(toAppend, dir)
			pathSet[dir] = true
		}
	}

	if len(toAppend) == 0 {
		return env
	}

	newPath := strings.Join(append(pathDirs, toAppend...), string(os.PathListSeparator))
	if strings.TrimSpace(currentPath) == "" {
		newPath = strings.Join(toAppend, string(os.PathListSeparator))
	}
	return UpsertEnv(env, "PATH", newPath)
}

func CommonUserBinDirectories() []string {
	directories := []string{"/opt/homebrew/bin", "/usr/local/bin"}
	homeDir, err := os.UserHomeDir()
	if err != nil || strings.TrimSpace(homeDir) == "" {
		return directories
	}

	return append(directories,
		filepath.Join(homeDir, ManagedRuntimeRootDirName, "bin"),
		filepath.Join(homeDir, ".local", "bin"),
		filepath.Join(homeDir, ".bun", "bin"),
		filepath.Join(homeDir, ".npm-global", "bin"),
		filepath.Join(homeDir, "go", "bin"),
		filepath.Join(homeDir, ".cargo", "bin"),
	)
}

func resolveOrigZdotdir(env []string, managedZshDir string, homeDir string) string {
	zdotdir := EnvValueOrDefault(env, "ZDOTDIR", "")
	if zdotdir == "" || zdotdir == managedZshDir {
		return EnvValueOrDefault(env, "HOME", homeDir)
	}
	return zdotdir
}
