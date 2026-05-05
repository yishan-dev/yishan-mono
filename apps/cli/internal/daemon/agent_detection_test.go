package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestListAgentCLIDetectionStatusesWithOptionsDetectsVersion(t *testing.T) {
	t.Setenv("PATH", "")

	if runtime.GOOS == "windows" {
		t.Skip("test currently targets unix-style executable permissions")
	}

	binDir := t.TempDir()
	writeExecutableScript(t, binDir, "opencode", "0.11.3")
	writeExecutableScript(t, binDir, "codex", "1.2.0")

	statuses := listAgentCLIDetectionStatusesWithOptions(agentDetectionOptions{
		PathValue:      binDir,
		PathExtValue:   ".COM;.EXE;.BAT;.CMD",
		IsWindows:      false,
		ExcludedDirs:   map[string]struct{}{},
		VersionTimeout: 500 * time.Millisecond,
	})

	statusByAgent := map[string]AgentCLIDetectionStatus{}
	for _, status := range statuses {
		statusByAgent[status.AgentKind] = status
	}

	if len(statuses) != len(SupportedAgentCLIKinds) {
		t.Fatalf("expected %d statuses, got %d", len(SupportedAgentCLIKinds), len(statuses))
	}

	opencodeStatus := statusByAgent["opencode"]
	if !opencodeStatus.Detected {
		t.Fatalf("expected opencode to be detected")
	}
	if opencodeStatus.Version != "0.11.3" {
		t.Fatalf("expected opencode version 0.11.3, got %q", opencodeStatus.Version)
	}

	codexStatus := statusByAgent["codex"]
	if !codexStatus.Detected {
		t.Fatalf("expected codex to be detected")
	}
	if codexStatus.Version != "1.2.0" {
		t.Fatalf("expected codex version 1.2.0, got %q", codexStatus.Version)
	}

	claudeStatus := statusByAgent["claude"]
	if claudeStatus.Detected {
		t.Fatalf("expected claude to be undetected")
	}
	if claudeStatus.Version != "" {
		t.Fatalf("expected claude version to be empty, got %q", claudeStatus.Version)
	}

	geminiStatus := statusByAgent["gemini"]
	if geminiStatus.Detected {
		t.Fatalf("expected gemini to be undetected")
	}
	if geminiStatus.Version != "" {
		t.Fatalf("expected gemini version to be empty, got %q", geminiStatus.Version)
	}

	piStatus := statusByAgent["pi"]
	if piStatus.Detected {
		t.Fatalf("expected pi to be undetected")
	}
	if piStatus.Version != "" {
		t.Fatalf("expected pi version to be empty, got %q", piStatus.Version)
	}

	copilotStatus := statusByAgent["copilot"]
	if copilotStatus.Detected {
		t.Fatalf("expected copilot to be undetected")
	}
	if copilotStatus.Version != "" {
		t.Fatalf("expected copilot version to be empty, got %q", copilotStatus.Version)
	}

	cursorStatus := statusByAgent["cursor-agent"]
	if cursorStatus.Detected {
		t.Fatalf("expected cursor to be undetected")
	}
	if cursorStatus.Version != "" {
		t.Fatalf("expected cursor version to be empty, got %q", cursorStatus.Version)
	}
}

func TestListAgentCLIDetectionStatusesWithOptionsDetectsAgentBinaryNames(t *testing.T) {
	t.Setenv("PATH", "")

	if runtime.GOOS == "windows" {
		t.Skip("test currently targets unix-style executable permissions")
	}

	binDir := t.TempDir()
	writeExecutableScript(t, binDir, "copilot", "3.0.0")
	writeExecutableScript(t, binDir, "cursor", "1.0.0")

	statuses := listAgentCLIDetectionStatusesWithOptions(agentDetectionOptions{
		PathValue:      binDir,
		PathExtValue:   ".COM;.EXE;.BAT;.CMD",
		IsWindows:      false,
		ExcludedDirs:   map[string]struct{}{},
		VersionTimeout: 500 * time.Millisecond,
	})

	statusByAgent := map[string]AgentCLIDetectionStatus{}
	for _, status := range statuses {
		statusByAgent[status.AgentKind] = status
	}

	copilotStatus := statusByAgent["copilot"]
	if !copilotStatus.Detected {
		t.Fatalf("expected copilot to be detected by copilot binary")
	}
	if copilotStatus.Version != "3.0.0" {
		t.Fatalf("expected copilot version 3.0.0, got %q", copilotStatus.Version)
	}

	cursorStatus := statusByAgent["cursor-agent"]
	if !cursorStatus.Detected {
		t.Fatalf("expected cursor-agent to be detected by cursor binary")
	}
	if cursorStatus.Version != "1.0.0" {
		t.Fatalf("expected cursor version 1.0.0, got %q", cursorStatus.Version)
	}
}

func TestListAgentCLIDetectionStatusesWithOptionsSkipsExcludedDirectories(t *testing.T) {
	t.Setenv("PATH", "")

	if runtime.GOOS == "windows" {
		t.Skip("test currently targets unix-style executable permissions")
	}

	excludedBinDir := t.TempDir()
	writeExecutableScript(t, excludedBinDir, "claude", "2.0.1")

	statuses := listAgentCLIDetectionStatusesWithOptions(agentDetectionOptions{
		PathValue:      excludedBinDir,
		PathExtValue:   ".COM;.EXE;.BAT;.CMD",
		IsWindows:      false,
		ExcludedDirs:   map[string]struct{}{normalizeDirectoryPath(excludedBinDir): {}},
		VersionTimeout: 500 * time.Millisecond,
	})

	for _, status := range statuses {
		if status.AgentKind != "claude" {
			continue
		}

		if status.Detected {
			t.Fatalf("expected claude in excluded directory to be undetected")
		}
		if status.Version != "" {
			t.Fatalf("expected claude version to be empty, got %q", status.Version)
		}
	}
}

func TestResolveUserShellUsesEnvVariable(t *testing.T) {
	t.Setenv("SHELL", "/bin/custom-shell")

	result := resolveUserShell()

	if result != "/bin/custom-shell" {
		t.Fatalf("expected /bin/custom-shell, got %q", result)
	}
}

func TestResolveUserShellFallsBackToKnownShells(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test targets unix-style shells")
	}

	t.Setenv("SHELL", "")

	result := resolveUserShell()

	// On any unix system at least /bin/sh should exist.
	if result == "" {
		t.Fatal("expected a fallback shell path, got empty string")
	}

	knownShells := map[string]bool{"/bin/zsh": true, "/bin/bash": true, "/bin/sh": true}
	if !knownShells[result] {
		t.Fatalf("expected one of /bin/zsh, /bin/bash, /bin/sh, got %q", result)
	}
}

func TestResolveUserShellReturnsEmptyWhenNothingAvailable(t *testing.T) {
	if runtime.GOOS != "windows" {
		t.Skip("on unix systems fallback shells always exist")
	}

	t.Setenv("SHELL", "")

	result := resolveUserShell()

	if result != "" {
		t.Fatalf("expected empty string on windows, got %q", result)
	}
}

func writeExecutableScript(t *testing.T, dir string, commandName string, version string) {
	t.Helper()

	scriptPath := filepath.Join(dir, commandName)
	script := fmt.Sprintf("#!/bin/sh\necho \"%s %s\"\n", commandName, version)
	if err := os.WriteFile(scriptPath, []byte(script), 0o755); err != nil {
		t.Fatalf("write executable script %q: %v", scriptPath, err)
	}
}
