package workspace

import (
	"context"
	"os/exec"
	"strings"
)

type GitStatusRequest struct {
	WorkspaceID string `json:"workspaceId"`
}

type GitStatusResponse struct {
	Branch string   `json:"branch"`
	Files  []string `json:"files"`
	Raw    string   `json:"raw"`
}

func GitStatus(ctx context.Context, cwd string) (GitStatusResponse, error) {
	cmd := exec.CommandContext(ctx, "git", "-C", cwd, "status", "--porcelain", "--branch")
	out, err := cmd.Output()
	if err != nil {
		return GitStatusResponse{}, err
	}

	raw := strings.TrimSpace(string(out))
	if raw == "" {
		return GitStatusResponse{Branch: "", Files: nil, Raw: ""}, nil
	}

	lines := strings.Split(raw, "\n")
	resp := GitStatusResponse{Raw: raw}

	if len(lines) > 0 && strings.HasPrefix(lines[0], "##") {
		resp.Branch = strings.TrimSpace(strings.TrimPrefix(lines[0], "##"))
		lines = lines[1:]
	}

	files := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if len(line) > 3 {
			files = append(files, strings.TrimSpace(line[3:]))
		} else {
			files = append(files, line)
		}
	}
	resp.Files = files

	return resp, nil
}
