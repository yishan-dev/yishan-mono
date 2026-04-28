//go:build windows

package workspace

import "os/exec"

func stopTerminalProcess(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}

	return cmd.Process.Kill()
}
