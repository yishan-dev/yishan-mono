package workspace

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// DefaultHookTimeout is the maximum duration a lifecycle hook is allowed to
// run before the process is killed. Callers may override this per-invocation
// via HookRequest.Timeout.
const DefaultHookTimeout = 30 * time.Second

// HookRequest describes a lifecycle hook to execute.
type HookRequest struct {
	// Command is the shell command (or script path) to execute. When empty,
	// RunHook is a no-op and returns a zero-value HookResult with Skipped=true.
	Command string

	// WorkspaceID is injected as YISHAN_WORKSPACE_ID into the hook environment.
	WorkspaceID string

	// WorkspacePath is the absolute path to the workspace directory. It is
	// used as the working directory for the hook process and injected as
	// YISHAN_WORKSPACE_PATH.
	WorkspacePath string

	// HookName is a human-readable label for the lifecycle phase (e.g.
	// "setup" or "post"). It is injected as YISHAN_HOOK_NAME and used in
	// error messages.
	HookName string

	// Timeout overrides DefaultHookTimeout when set to a positive duration.
	Timeout time.Duration
}

// HookResult captures the outcome of a lifecycle hook execution.
type HookResult struct {
	// Skipped is true when no command was configured and the hook was not run.
	Skipped bool `json:"skipped"`

	// ExitCode is the process exit code. Zero indicates success.
	ExitCode int `json:"exitCode"`

	// Stdout captured from the hook process.
	Stdout string `json:"stdout"`

	// Stderr captured from the hook process.
	Stderr string `json:"stderr"`

	// Error is a human-readable description of any failure (timeout, exec
	// error, non-zero exit). Empty on success or skip.
	Error string `json:"error,omitempty"`
}

// RunHook executes a lifecycle hook command in a shell, scoped to the
// workspace directory with relevant environment variables. It enforces a
// timeout so hooks cannot hang workspace lifecycle indefinitely.
//
// When req.Command is empty the call is a no-op and returns Skipped=true.
// Hook failures are captured in HookResult rather than returned as errors;
// only unexpected system-level problems (e.g. cannot start shell) are returned
// as errors.
func RunHook(ctx context.Context, req HookRequest) (HookResult, error) {
	command := strings.TrimSpace(req.Command)
	if command == "" {
		return HookResult{Skipped: true}, nil
	}

	timeout := req.Timeout
	if timeout <= 0 {
		timeout = DefaultHookTimeout
	}

	hookCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(hookCtx, "sh", "-c", command)
	cmd.Dir = req.WorkspacePath

	cmd.Env = append(cmd.Environ(),
		"YISHAN_WORKSPACE_ID="+req.WorkspaceID,
		"YISHAN_WORKSPACE_PATH="+req.WorkspacePath,
		"YISHAN_HOOK_NAME="+req.HookName,
	)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	result := HookResult{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: -1, // Safe default if process never started.
	}
	if cmd.ProcessState != nil {
		result.ExitCode = cmd.ProcessState.ExitCode()
	}

	if err != nil {
		if hookCtx.Err() == context.DeadlineExceeded {
			result.Error = fmt.Sprintf("%s hook timed out after %s", req.HookName, timeout)
		} else if ctx.Err() == context.Canceled {
			result.Error = fmt.Sprintf("%s hook canceled", req.HookName)
		} else if exitErr, ok := err.(*exec.ExitError); ok {
			result.Error = fmt.Sprintf("%s hook exited with code %d", req.HookName, exitErr.ExitCode())
		} else {
			// Unexpected system error (shell not found, permission denied, etc.)
			return result, fmt.Errorf("run %s hook: %w", req.HookName, err)
		}
	}

	return result, nil
}
