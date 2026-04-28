package workspace

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestResolveTerminalCommand(t *testing.T) {
	tests := []struct {
		name            string
		request         TerminalStartRequest
		goos            string
		shellEnv        string
		wantCommand     string
		wantArgsLen     int
		wantFirstArg    string
		wantArgsPresent bool
	}{
		{
			name: "uses explicit command when provided",
			request: TerminalStartRequest{
				Command: "python",
				Args:    []string{"-V"},
			},
			goos:            "darwin",
			shellEnv:        "/bin/zsh",
			wantCommand:     "python",
			wantArgsLen:     1,
			wantFirstArg:    "-V",
			wantArgsPresent: true,
		},
		{
			name:            "uses shell env on unix when command missing",
			request:         TerminalStartRequest{},
			goos:            "linux",
			shellEnv:        "/bin/zsh",
			wantCommand:     "/bin/zsh",
			wantArgsLen:     1,
			wantFirstArg:    "-l",
			wantArgsPresent: true,
		},
		{
			name: "keeps explicit default shell args",
			request: TerminalStartRequest{
				Args: []string{"-f"},
			},
			goos:            "linux",
			shellEnv:        "/bin/zsh",
			wantCommand:     "/bin/zsh",
			wantArgsLen:     1,
			wantFirstArg:    "-f",
			wantArgsPresent: true,
		},
		{
			name:            "falls back to zsh on darwin when shell env missing",
			request:         TerminalStartRequest{},
			goos:            "darwin",
			shellEnv:        "",
			wantCommand:     "/bin/zsh",
			wantArgsLen:     1,
			wantFirstArg:    "-l",
			wantArgsPresent: true,
		},
		{
			name:            "falls back to bash on linux when shell env missing",
			request:         TerminalStartRequest{},
			goos:            "linux",
			shellEnv:        "",
			wantCommand:     "/bin/bash",
			wantArgsLen:     1,
			wantFirstArg:    "--login",
			wantArgsPresent: true,
		},
		{
			name:            "uses cmd on windows",
			request:         TerminalStartRequest{},
			goos:            "windows",
			shellEnv:        "C:/Program Files/Git/bin/bash.exe",
			wantCommand:     "cmd.exe",
			wantArgsLen:     0,
			wantArgsPresent: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gotCommand, gotArgs := resolveTerminalCommand(test.request, test.goos, test.shellEnv)
			if gotCommand != test.wantCommand {
				t.Fatalf("expected command %q, got %q", test.wantCommand, gotCommand)
			}
			if len(gotArgs) != test.wantArgsLen {
				t.Fatalf("expected %d args, got %d", test.wantArgsLen, len(gotArgs))
			}
			if test.wantArgsPresent && gotArgs[0] != test.wantFirstArg {
				t.Fatalf("expected first arg %q, got %q", test.wantFirstArg, gotArgs[0])
			}
		})
	}
}

func TestResolveTerminalEnvDefaults(t *testing.T) {
	got := resolveTerminalEnv([]string{"PATH=/usr/bin"}, []string{"TERM=screen-256color"})
	joined := strings.Join(got, "\n")

	if !strings.Contains(joined, "TERM=screen-256color") {
		t.Fatalf("expected request env to override TERM, got %v", got)
	}
	if !strings.Contains(joined, "COLORTERM=truecolor") {
		t.Fatalf("expected COLORTERM default, got %v", got)
	}
	if !strings.Contains(joined, "LANG=en_US.UTF-8") {
		t.Fatalf("expected LANG default, got %v", got)
	}
}

func TestTerminalSessionSendReadStop(t *testing.T) {
	m := NewTerminalManager()

	start, err := m.Start(context.Background(), t.TempDir(), TerminalStartRequest{Command: "cat"})
	if err != nil {
		t.Fatalf("start terminal: %v", err)
	}
	t.Cleanup(func() {
		_, _ = m.Stop(TerminalStopRequest{SessionID: start.SessionID})
	})

	input := "hello-from-test\n"
	if _, err := m.Send(TerminalSendRequest{SessionID: start.SessionID, Input: input}); err != nil {
		t.Fatalf("send input: %v", err)
	}

	deadline := time.Now().Add(2 * time.Second)
	var output strings.Builder
	for time.Now().Before(deadline) {
		resp, err := m.Read(TerminalReadRequest{SessionID: start.SessionID})
		if err != nil {
			t.Fatalf("read output: %v", err)
		}
		output.WriteString(resp.Output)
		if strings.Contains(output.String(), "hello-from-test") {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	if !strings.Contains(output.String(), "hello-from-test") {
		t.Fatalf("expected output to contain sent input, got %q", output.String())
	}

	stopped, err := m.Stop(TerminalStopRequest{SessionID: start.SessionID})
	if err != nil {
		t.Fatalf("stop terminal: %v", err)
	}
	if !stopped.Stopped {
		t.Fatal("expected stop to report stopped=true")
	}
}

func TestTerminalSubscriptionStreamsOutputAndExit(t *testing.T) {
	m := NewTerminalManager()

	start, err := m.Start(context.Background(), t.TempDir(), TerminalStartRequest{
		Command: "sh",
		Args:    []string{"-c", `read line; printf "echo:%s\n" "$line"`},
	})
	if err != nil {
		t.Fatalf("start terminal: %v", err)
	}
	t.Cleanup(func() {
		_, _ = m.Stop(TerminalStopRequest{SessionID: start.SessionID})
	})

	sub, err := m.Subscribe(TerminalSubscribeRequest{SessionID: start.SessionID})
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}

	if _, err := m.Send(TerminalSendRequest{SessionID: start.SessionID, Input: "ping\n"}); err != nil {
		t.Fatalf("send input: %v", err)
	}

	deadline := time.After(3 * time.Second)
	var seenOutput bool
	var seenExit bool

	for !seenOutput || !seenExit {
		select {
		case event, ok := <-sub.Events:
			if !ok {
				if !seenExit {
					t.Fatal("subscription closed before exit event")
				}
				return
			}
			switch event.Type {
			case "output":
				if strings.Contains(event.Chunk, "echo:ping") {
					seenOutput = true
				}
			case "exit":
				if event.ExitCode == nil {
					t.Fatal("expected exit code in exit event")
				}
				if *event.ExitCode != 0 {
					t.Fatalf("expected exit code 0, got %d", *event.ExitCode)
				}
				seenExit = true
			}
		case <-deadline:
			t.Fatalf("timed out waiting for output+exit events (seenOutput=%t, seenExit=%t)", seenOutput, seenExit)
		}
	}
}

func TestTerminalResizeAndUnsubscribe(t *testing.T) {
	m := NewTerminalManager()

	start, err := m.Start(context.Background(), t.TempDir(), TerminalStartRequest{Command: "cat"})
	if err != nil {
		t.Fatalf("start terminal: %v", err)
	}
	t.Cleanup(func() {
		_, _ = m.Stop(TerminalStopRequest{SessionID: start.SessionID})
	})

	if _, err := m.Resize(TerminalResizeRequest{SessionID: start.SessionID, Cols: 120, Rows: 40}); err != nil {
		t.Fatalf("resize terminal: %v", err)
	}

	if _, err := m.Resize(TerminalResizeRequest{SessionID: start.SessionID, Cols: 0, Rows: 40}); err == nil {
		t.Fatal("expected resize error when cols is zero")
	}

	sub, err := m.Subscribe(TerminalSubscribeRequest{SessionID: start.SessionID})
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}

	resp, err := m.Unsubscribe(TerminalUnsubscribeRequest{SessionID: start.SessionID, SubscriptionID: sub.ID})
	if err != nil {
		t.Fatalf("unsubscribe: %v", err)
	}
	if !resp.Unsubscribed {
		t.Fatal("expected unsubscribed=true")
	}

	select {
	case _, ok := <-sub.Events:
		if ok {
			t.Fatal("expected subscription channel to be closed")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("timed out waiting for subscription channel close")
	}
}
