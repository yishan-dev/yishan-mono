package daemon

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"yishan/apps/cli/internal/api"
	cliruntime "yishan/apps/cli/internal/runtime"
)

const (
	streamKey          = "scheduled-job-runs"
	consumerGroup      = "daemon-consumers"
	agentExecTimeout   = 5 * time.Minute
	blockTimeout       = 30 * time.Second
	reclaimInterval    = 60 * time.Second
	reclaimMinIdle     = 2 * time.Minute
)

func StartSchedulerLoop(daemonID string, stop <-chan struct{}) {
	redisURL := cliruntime.RedisURL()
	if redisURL == "" {
		log.Debug().Msg("scheduler: REDIS_URL not configured, skipping scheduler loop")
		return
	}
	if !cliruntime.APIConfigured() {
		log.Debug().Msg("scheduler: API not configured, skipping scheduler loop")
		return
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Error().Err(err).Msg("scheduler: invalid REDIS_URL")
		return
	}

	rdb := redis.NewClient(opts)
	defer rdb.Close()

	ctx := context.Background()

	err = rdb.XGroupCreateMkStream(ctx, streamKey, consumerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		log.Error().Err(err).Msg("scheduler: failed to create consumer group")
		return
	}

	log.Info().Str("stream", streamKey).Str("group", consumerGroup).Msg("scheduler: started stream consumer")

	reclaimTicker := time.NewTicker(reclaimInterval)
	defer reclaimTicker.Stop()

	for {
		select {
		case <-stop:
			log.Info().Msg("scheduler: stopping stream consumer")
			return
		case <-reclaimTicker.C:
			reclaimPending(ctx, rdb, daemonID)
		default:
			readAndProcess(ctx, rdb, daemonID, stop)
		}
	}
}

func readAndProcess(ctx context.Context, rdb *redis.Client, daemonID string, stop <-chan struct{}) {
	streams, err := rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    consumerGroup,
		Consumer: daemonID,
		Streams:  []string{streamKey, ">"},
		Count:    10,
		Block:    blockTimeout,
	}).Result()

	if err != nil {
		if err == redis.Nil {
			return
		}
		select {
		case <-stop:
			return
		default:
		}
		log.Error().Err(err).Msg("scheduler: XREADGROUP failed")
		time.Sleep(5 * time.Second)
		return
	}

	for _, stream := range streams {
		for _, msg := range stream.Messages {
			processMessage(ctx, rdb, daemonID, msg)
		}
	}
}

func reclaimPending(ctx context.Context, rdb *redis.Client, daemonID string) {
	pending, err := rdb.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: streamKey,
		Group:  consumerGroup,
		Start:  "-",
		End:    "+",
		Count:  20,
		Idle:   reclaimMinIdle,
	}).Result()

	if err != nil {
		log.Error().Err(err).Msg("scheduler: failed to check pending messages")
		return
	}

	for _, p := range pending {
		claimed, err := rdb.XClaim(ctx, &redis.XClaimArgs{
			Stream:   streamKey,
			Group:    consumerGroup,
			Consumer: daemonID,
			MinIdle:  reclaimMinIdle,
			Messages: []string{p.ID},
		}).Result()
		if err != nil {
			log.Error().Err(err).Str("id", p.ID).Msg("scheduler: XCLAIM failed")
			continue
		}
		for _, msg := range claimed {
			processMessage(ctx, rdb, daemonID, msg)
		}
	}
}

func processMessage(ctx context.Context, rdb *redis.Client, daemonID string, msg redis.XMessage) {
	runID, _ := msg.Values["runId"].(string)
	nodeID, _ := msg.Values["nodeId"].(string)
	agentKind, _ := msg.Values["agentKind"].(string)
	prompt, _ := msg.Values["prompt"].(string)
	model, _ := msg.Values["model"].(string)
	command, _ := msg.Values["command"].(string)

	if runID == "" || nodeID == "" || prompt == "" {
		log.Warn().Str("msgId", msg.ID).Msg("scheduler: skipping malformed message")
		rdb.XAck(ctx, streamKey, consumerGroup, msg.ID)
		return
	}

	if nodeID != daemonID {
		rdb.XAck(ctx, streamKey, consumerGroup, msg.ID)
		return
	}

	client := cliruntime.APIClient()

	_, err := client.StartScheduledJobRun(daemonID, api.StartScheduledJobRunInput{
		RunID:     runID,
		StartedAt: time.Now().UTC().Format(time.RFC3339),
	})
	if err != nil {
		log.Error().Err(err).Str("runId", runID).Msg("scheduler: failed to mark run started")
	}

	log.Info().
		Str("runId", runID).
		Str("agentKind", agentKind).
		Str("prompt", prompt).
		Str("model", model).
		Str("command", command).
		Msg("scheduler: executing agent")

	output, execErr := runAgent(agentKind, prompt, model, command)
	finishedAt := time.Now().UTC().Format(time.RFC3339)

	input := api.CompleteScheduledJobRunInput{
		RunID:      runID,
		FinishedAt: finishedAt,
	}

	if execErr != nil {
		input.Status = "failed"
		input.ErrorCode = "AGENT_EXEC_ERROR"
		input.ErrorMessage = execErr.Error()
		if output != "" {
			input.ResponseBody = output
		}
	} else {
		input.Status = "succeeded"
		if output != "" {
			input.ResponseBody = output
		}
	}

	_, reportErr := client.CompleteScheduledJobRun(daemonID, input)
	if reportErr != nil {
		log.Error().Err(reportErr).Str("runId", runID).Msg("scheduler: failed to report run result")
	}

	rdb.XAck(ctx, streamKey, consumerGroup, msg.ID)
}

func resolveAgentCommand(agentKind string) string {
	switch agentKind {
	case "", "opencode":
		return "opencode"
	case "codex":
		return "codex"
	case "claude":
		return "claude"
	case "gemini":
		return "gemini"
	case "pi":
		return "pi"
	case "copilot":
		return "copilot"
	case "cursor", "cursor-agent":
		return "cursor"
	default:
		return ""
	}
}

func runAgent(agentKind, prompt, model, command string) (output string, err error) {
	binary := resolveAgentCommand(agentKind)
	if binary == "" {
		return "", fmt.Errorf("unsupported agent kind: %s", agentKind)
	}

	args := []string{"run", "--prompt", prompt}

	if model != "" {
		args = append(args, "--model", model)
	}
	if command != "" {
		args = append(args, "--command", command)
	}

	cmd := exec.Command(binary, args...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	done := make(chan error, 1)
	if startErr := cmd.Start(); startErr != nil {
		return "", fmt.Errorf("failed to start agent: %w", startErr)
	}
	go func() { done <- cmd.Wait() }()

	select {
	case waitErr := <-done:
		combined := stdout.String()
		if stderr.Len() > 0 {
			combined += "\n" + stderr.String()
		}
		if waitErr != nil {
			return combined, fmt.Errorf("agent exited with error: %w", waitErr)
		}
		return combined, nil
	case <-time.After(agentExecTimeout):
		_ = cmd.Process.Kill()
		return stdout.String(), fmt.Errorf("agent timed out after %s", agentExecTimeout)
	}
}
