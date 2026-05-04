package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog/log"
)

const watcherDebounce = 200 * time.Millisecond

type worktreeWatcher struct {
	mu            sync.Mutex
	path          string
	fw            *fsnotify.Watcher
	events        *eventHub
	fileTimer     *time.Timer
	gitTimer      *time.Timer
	changedPaths  []string
	done          chan struct{}
}

type workspaceWatchers struct {
	mu       sync.Mutex
	entries  map[string]*worktreeWatcher
	events   *eventHub
}

func newWorkspaceWatchers(events *eventHub) *workspaceWatchers {
	return &workspaceWatchers{
		entries: make(map[string]*worktreeWatcher),
		events:  events,
	}
}

func (ws *workspaceWatchers) Watch(worktreePath string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if _, ok := ws.entries[worktreePath]; ok {
		return
	}

	gitDir := filepath.Join(worktreePath, ".git")
	if _, err := os.Stat(gitDir); err != nil {
		return
	}

	fw, err := fsnotify.NewWatcher()
	if err != nil {
		log.Warn().Err(err).Str("path", worktreePath).Msg("failed to create workspace fsnotify watcher")
		return
	}

	entry := &worktreeWatcher{
		path:   worktreePath,
		fw:     fw,
		events: ws.events,
		done:   make(chan struct{}),
	}

	if err := fw.Add(worktreePath); err != nil {
		log.Debug().Err(err).Str("target", worktreePath).Msg("failed to watch worktree root")
	}

	gitTargets := []string{gitDir, filepath.Join(gitDir, "HEAD"), filepath.Join(gitDir, "index")}
	gitRefsDir := filepath.Join(gitDir, "refs")
	if fi, err := os.Stat(gitRefsDir); err == nil && fi.IsDir() {
		gitTargets = append(gitTargets, gitRefsDir)
	}

	seen := make(map[string]bool)
	for _, t := range gitTargets {
		if seen[t] {
			continue
		}
		seen[t] = true
		addTarget := t
		if fi, err := os.Stat(t); err == nil && !fi.IsDir() {
			addTarget = filepath.Dir(t)
		}
		if err := fw.Add(addTarget); err != nil {
			log.Debug().Err(err).Str("target", addTarget).Msg("failed to watch git target")
		}
	}

	go entry.consume()
	ws.entries[worktreePath] = entry
}

func (ws *workspaceWatchers) Unwatch(worktreePath string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	entry, ok := ws.entries[worktreePath]
	if !ok {
		return
	}

	entry.close()
	delete(ws.entries, worktreePath)
}

func (ws *workspaceWatchers) Close() {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	for path, entry := range ws.entries {
		entry.close()
		delete(ws.entries, path)
	}
}

func (w *worktreeWatcher) consume() {
	gitDir := filepath.Join(w.path, ".git")
	for {
		select {
		case <-w.done:
			return
		case event, ok := <-w.fw.Events:
			if !ok {
				return
			}
			isGit := strings.HasPrefix(event.Name, gitDir)
			if isGit {
				w.scheduleGitEmit()
			} else {
				relPath, err := filepath.Rel(w.path, event.Name)
				if err != nil {
					relPath = event.Name
				}
				w.scheduleFileEmit(filepath.ToSlash(relPath))
			}
		case <-w.fw.Errors:
		}
	}
}

func (w *worktreeWatcher) scheduleFileEmit(relPath string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.changedPaths = append(w.changedPaths, relPath)

	if w.fileTimer != nil {
		w.fileTimer.Stop()
	}

	w.fileTimer = time.AfterFunc(watcherDebounce, func() {
		w.mu.Lock()
		paths := w.changedPaths
		w.changedPaths = nil
		w.fileTimer = nil
		w.mu.Unlock()

		deduped := dedupePaths(paths)
		changedPaths := make([]string, 0, len(deduped))
		for p := range deduped {
			changedPaths = append(changedPaths, p)
		}

		w.events.Publish(frontendEvent{
			Topic: "workspaceFilesChanged",
			Payload: map[string]any{
				"workspaceWorktreePath": w.path,
				"changedRelativePaths":  changedPaths,
			},
		})
	})
}

func dedupePaths(paths []string) map[string]bool {
	seen := make(map[string]bool, len(paths))
	for _, p := range paths {
		seen[p] = true
	}
	return seen
}

func (w *worktreeWatcher) scheduleGitEmit() {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.gitTimer != nil {
		w.gitTimer.Stop()
	}

	w.gitTimer = time.AfterFunc(watcherDebounce, func() {
		w.mu.Lock()
		w.gitTimer = nil
		w.mu.Unlock()

		w.events.Publish(frontendEvent{
			Topic: "gitChanged",
			Payload: map[string]any{
				"workspaceWorktreePath": w.path,
			},
		})
	})
}

func (w *worktreeWatcher) close() {
	close(w.done)
	w.fw.Close()

	w.mu.Lock()
	if w.fileTimer != nil {
		w.fileTimer.Stop()
		w.fileTimer = nil
	}
	if w.gitTimer != nil {
		w.gitTimer.Stop()
		w.gitTimer = nil
	}
	w.changedPaths = nil
	w.mu.Unlock()
}
