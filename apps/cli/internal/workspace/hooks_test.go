package workspace

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRunHook_SkipsEmptyCommand(t *testing.T) {
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "",
		WorkspaceID:   "ws-1",
		WorkspacePath: t.TempDir(),
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Skipped {
		t.Fatalf("expected Skipped=true for empty command")
	}
	if result.Error != "" {
		t.Fatalf("expected no error message, got %q", result.Error)
	}
}

func TestRunHook_SkipsWhitespaceOnlyCommand(t *testing.T) {
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "   \t  ",
		WorkspaceID:   "ws-1",
		WorkspacePath: t.TempDir(),
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Skipped {
		t.Fatalf("expected Skipped=true for whitespace-only command")
	}
}

func TestRunHook_SuccessfulExecution(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "echo hello",
		WorkspaceID:   "ws-42",
		WorkspacePath: dir,
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Skipped {
		t.Fatalf("expected Skipped=false")
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d", result.ExitCode)
	}
	if strings.TrimSpace(result.Stdout) != "hello" {
		t.Fatalf("stdout mismatch: got %q", result.Stdout)
	}
	if result.Error != "" {
		t.Fatalf("unexpected error message: %q", result.Error)
	}
}

func TestRunHook_CapturesStderr(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "echo oops >&2",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "post",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.TrimSpace(result.Stderr) != "oops" {
		t.Fatalf("stderr mismatch: got %q", result.Stderr)
	}
}

func TestRunHook_NonZeroExitCode(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "exit 7",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("non-zero exit should not return error, got: %v", err)
	}
	if result.ExitCode != 7 {
		t.Fatalf("expected exit code 7, got %d", result.ExitCode)
	}
	if result.Error == "" {
		t.Fatalf("expected error message for non-zero exit")
	}
	if !strings.Contains(result.Error, "setup hook exited with code 7") {
		t.Fatalf("unexpected error message: %q", result.Error)
	}
}

func TestRunHook_Timeout(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "sleep 60",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "setup",
		Timeout:       100 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("timeout should not return error, got: %v", err)
	}
	if result.Error == "" {
		t.Fatalf("expected error message for timeout")
	}
	if !strings.Contains(result.Error, "timed out") {
		t.Fatalf("expected timeout error, got %q", result.Error)
	}
}

func TestRunHook_InjectsEnvironmentVariables(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "echo $YISHAN_WORKSPACE_ID $YISHAN_WORKSPACE_PATH $YISHAN_HOOK_NAME",
		WorkspaceID:   "ws-env-test",
		WorkspacePath: dir,
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	output := strings.TrimSpace(result.Stdout)
	expected := "ws-env-test " + dir + " setup"
	if output != expected {
		t.Fatalf("env var output mismatch:\n  got:  %q\n  want: %q", output, expected)
	}
}

func TestRunHook_UsesWorkspacePathAsWorkingDirectory(t *testing.T) {
	dir := t.TempDir()
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "pwd",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	output := strings.TrimSpace(result.Stdout)
	// Resolve symlinks for macOS /private/var vs /var
	resolvedDir, _ := filepath.EvalSymlinks(dir)
	resolvedOutput, _ := filepath.EvalSymlinks(output)
	if resolvedOutput != resolvedDir {
		t.Fatalf("working dir mismatch: got %q, want %q", resolvedOutput, resolvedDir)
	}
}

func TestRunHook_ScriptCreatesFile(t *testing.T) {
	dir := t.TempDir()
	sentinel := filepath.Join(dir, "hook-ran.txt")

	result, err := RunHook(context.Background(), HookRequest{
		Command:       "echo done > hook-ran.txt",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "setup",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ExitCode != 0 {
		t.Fatalf("expected exit code 0, got %d (stderr: %s)", result.ExitCode, result.Stderr)
	}

	content, err := os.ReadFile(sentinel)
	if err != nil {
		t.Fatalf("hook did not create sentinel file: %v", err)
	}
	if strings.TrimSpace(string(content)) != "done" {
		t.Fatalf("sentinel content mismatch: got %q", string(content))
	}
}

func TestRunHook_RespectsContextCancellation(t *testing.T) {
	dir := t.TempDir()
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	result, err := RunHook(ctx, HookRequest{
		Command:       "sleep 60",
		WorkspaceID:   "ws-1",
		WorkspacePath: dir,
		HookName:      "post",
		Timeout:       5 * time.Second,
	})
	// Either the hook returns a result with an error or a system error.
	// Both are acceptable since the parent context is already cancelled.
	if err == nil && result.Error == "" && result.ExitCode == 0 {
		t.Fatalf("expected cancellation to stop the hook")
	}
}

func TestRunHook_InvalidWorkspacePath(t *testing.T) {
	result, err := RunHook(context.Background(), HookRequest{
		Command:       "echo should not run",
		WorkspaceID:   "ws-1",
		WorkspacePath: "/nonexistent/path/that/does/not/exist",
		HookName:      "setup",
	})
	// System error: working directory does not exist, process cannot start.
	// Must not panic (ProcessState may be nil).
	if err == nil && result.Error == "" {
		t.Fatalf("expected error for invalid workspace path")
	}
	if result.ExitCode == 0 {
		t.Fatalf("expected non-zero exit code for failed start, got 0")
	}
}

func TestRunHook_DefaultTimeout(t *testing.T) {
	// Verify that DefaultHookTimeout is reasonable (not zero).
	if DefaultHookTimeout <= 0 {
		t.Fatalf("DefaultHookTimeout must be positive, got %s", DefaultHookTimeout)
	}
	if DefaultHookTimeout < 10*time.Second {
		t.Fatalf("DefaultHookTimeout seems too short: %s", DefaultHookTimeout)
	}
}
