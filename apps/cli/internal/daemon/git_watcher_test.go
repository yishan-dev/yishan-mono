package daemon

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestResolveGitDir_StandardRepo(t *testing.T) {
	root := t.TempDir()
	gitDir := filepath.Join(root, ".git")
	if err := os.MkdirAll(gitDir, 0o755); err != nil {
		t.Fatal(err)
	}

	resolved := resolveGitDir(root)
	if resolved != gitDir {
		t.Errorf("expected %q, got %q", gitDir, resolved)
	}
}

func TestResolveGitDir_WorktreeFile(t *testing.T) {
	root := t.TempDir()

	// Create the actual git directory that the worktree points to
	actualGitDir := filepath.Join(root, "main-repo", ".git", "worktrees", "my-worktree")
	if err := os.MkdirAll(actualGitDir, 0o755); err != nil {
		t.Fatal(err)
	}
	// Create HEAD and index in the actual git dir
	if err := os.WriteFile(filepath.Join(actualGitDir, "HEAD"), []byte("ref: refs/heads/my-branch\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(actualGitDir, "index"), []byte("fake-index"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Create the worktree directory with a .git file
	worktreeDir := filepath.Join(root, "worktree")
	if err := os.MkdirAll(worktreeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	gitFileContent := "gitdir: " + actualGitDir + "\n"
	if err := os.WriteFile(filepath.Join(worktreeDir, ".git"), []byte(gitFileContent), 0o644); err != nil {
		t.Fatal(err)
	}

	resolved := resolveGitDir(worktreeDir)
	if resolved != actualGitDir {
		t.Errorf("expected %q, got %q", actualGitDir, resolved)
	}
}

func TestResolveGitDir_WorktreeFileRelativePath(t *testing.T) {
	root := t.TempDir()

	// Create the actual git directory
	actualGitDir := filepath.Join(root, "main-repo", ".git", "worktrees", "my-worktree")
	if err := os.MkdirAll(actualGitDir, 0o755); err != nil {
		t.Fatal(err)
	}

	// Create a worktree with a relative gitdir path
	worktreeDir := filepath.Join(root, "main-repo", "worktrees", "my-worktree")
	if err := os.MkdirAll(worktreeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	// Relative path from worktreeDir to actualGitDir
	gitFileContent := "gitdir: ../../.git/worktrees/my-worktree\n"
	if err := os.WriteFile(filepath.Join(worktreeDir, ".git"), []byte(gitFileContent), 0o644); err != nil {
		t.Fatal(err)
	}

	resolved := resolveGitDir(worktreeDir)
	if resolved != actualGitDir {
		t.Errorf("expected %q, got %q", actualGitDir, resolved)
	}
}

func TestResolveGitDir_NoGitEntry(t *testing.T) {
	root := t.TempDir()

	resolved := resolveGitDir(root)
	expected := filepath.Join(root, ".git")
	if resolved != expected {
		t.Errorf("expected %q, got %q", expected, resolved)
	}
}

func TestResolveGitDir_InvalidGitFileContent(t *testing.T) {
	root := t.TempDir()

	// Write a .git file without the "gitdir: " prefix
	if err := os.WriteFile(filepath.Join(root, ".git"), []byte("some-random-content\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	resolved := resolveGitDir(root)
	expected := filepath.Join(root, ".git")
	if resolved != expected {
		t.Errorf("expected %q, got %q", expected, resolved)
	}
}

// evalSymlinks resolves symlinks for temp dirs (macOS /var -> /private/var).
func evalSymlinks(t *testing.T, path string) string {
	t.Helper()
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		t.Fatal(err)
	}
	return resolved
}

func TestWorktreeWatcher_DetectsGitChangesInResolvedDir(t *testing.T) {
	root := evalSymlinks(t, t.TempDir())

	// Create the actual git directory (simulating a worktree)
	actualGitDir := filepath.Join(root, "main-repo", ".git", "worktrees", "my-worktree")
	if err := os.MkdirAll(actualGitDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(actualGitDir, "HEAD"), []byte("ref: refs/heads/main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(actualGitDir, "index"), []byte("fake-index"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Create the worktree directory with .git file
	worktreeDir := filepath.Join(root, "worktree")
	if err := os.MkdirAll(worktreeDir, 0o755); err != nil {
		t.Fatal(err)
	}
	gitFileContent := "gitdir: " + actualGitDir + "\n"
	if err := os.WriteFile(filepath.Join(worktreeDir, ".git"), []byte(gitFileContent), 0o644); err != nil {
		t.Fatal(err)
	}

	hub := newEventHub()
	watchers := newWorkspaceWatchers(hub)
	defer watchers.Close()

	subID, events := hub.Subscribe()
	defer hub.Unsubscribe(subID)

	watchers.Watch(worktreeDir)

	// Modify the index file in the resolved git directory
	time.Sleep(100 * time.Millisecond) // give watcher time to start
	if err := os.WriteFile(filepath.Join(actualGitDir, "index"), []byte("updated-index"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Wait for the debounced event
	select {
	case event := <-events:
		if event.Topic != "gitChanged" {
			t.Errorf("expected topic 'gitChanged', got %q", event.Topic)
		}
		payload, ok := event.Payload.(map[string]any)
		if !ok {
			t.Fatal("expected map payload")
		}
		if payload["workspaceWorktreePath"] != worktreeDir {
			t.Errorf("expected worktreePath %q, got %q", worktreeDir, payload["workspaceWorktreePath"])
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for gitChanged event")
	}
}

func TestWorktreeWatcher_DetectsGitChangesInStandardRepo(t *testing.T) {
	root := evalSymlinks(t, t.TempDir())

	// Create a standard .git directory
	gitDir := filepath.Join(root, ".git")
	if err := os.MkdirAll(gitDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(gitDir, "HEAD"), []byte("ref: refs/heads/main\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(gitDir, "index"), []byte("fake-index"), 0o644); err != nil {
		t.Fatal(err)
	}

	hub := newEventHub()
	watchers := newWorkspaceWatchers(hub)
	defer watchers.Close()

	subID, events := hub.Subscribe()
	defer hub.Unsubscribe(subID)

	watchers.Watch(root)

	// Modify the index file
	time.Sleep(100 * time.Millisecond)
	if err := os.WriteFile(filepath.Join(gitDir, "index"), []byte("updated-index"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Wait for the debounced event
	select {
	case event := <-events:
		if event.Topic != "gitChanged" {
			t.Errorf("expected topic 'gitChanged', got %q", event.Topic)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for gitChanged event")
	}
}

func TestWorktreeWatcher_DetectsFileChangesInWorktree(t *testing.T) {
	root := evalSymlinks(t, t.TempDir())

	// Create a standard .git directory
	gitDir := filepath.Join(root, ".git")
	if err := os.MkdirAll(gitDir, 0o755); err != nil {
		t.Fatal(err)
	}

	hub := newEventHub()
	watchers := newWorkspaceWatchers(hub)
	defer watchers.Close()

	subID, events := hub.Subscribe()
	defer hub.Unsubscribe(subID)

	watchers.Watch(root)

	// Create a new file in the worktree root
	time.Sleep(100 * time.Millisecond)
	if err := os.WriteFile(filepath.Join(root, "newfile.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Wait for the debounced event
	select {
	case event := <-events:
		if event.Topic != "workspaceFilesChanged" {
			t.Errorf("expected topic 'workspaceFilesChanged', got %q", event.Topic)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for workspaceFilesChanged event")
	}
}
