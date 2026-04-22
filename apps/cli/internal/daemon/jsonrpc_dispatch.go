package daemon

import (
	"context"
	"encoding/json"
	"fmt"

	"yishan/apps/cli/internal/daemonrpc"
	"yishan/apps/cli/internal/workspace"
)

func (h *JSONRPCHandler) dispatch(ctx context.Context, client *wsClient, method string, params json.RawMessage) (any, error) {
	switch method {
	case daemonrpc.MethodDaemonPing:
		return map[string]string{"status": "ok"}, nil
	case daemonrpc.MethodWorkspaceOpen:
		var req workspace.OpenRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.Open(req)
	case daemonrpc.MethodWorkspaceList:
		return h.manager.List(), nil
	case daemonrpc.MethodWorkspaceFileRead:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileRead(req.WorkspaceID, req.Path)
	case daemonrpc.MethodWorkspaceFileList:
		var req fileListParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileList(req.WorkspaceID, req.Path)
	case daemonrpc.MethodWorkspaceFileStat:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileStat(req.WorkspaceID, req.Path)
	case daemonrpc.MethodWorkspaceFileWrite:
		var req fileWriteParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileWrite(req.WorkspaceID, req.Path, req.Content, req.Mode)
	case daemonrpc.MethodWorkspaceFileDelete:
		var req fileDeleteParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileDelete(req.WorkspaceID, req.Path, req.Recursive); err != nil {
			return nil, err
		}
		return map[string]bool{"deleted": true}, nil
	case daemonrpc.MethodWorkspaceFileMove:
		var req fileMoveParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileMove(req.WorkspaceID, req.FromPath, req.ToPath); err != nil {
			return nil, err
		}
		return map[string]bool{"moved": true}, nil
	case daemonrpc.MethodWorkspaceFileMkdir:
		var req fileMkdirParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileMkdir(req.WorkspaceID, req.Path, req.Parents, req.Mode); err != nil {
			return nil, err
		}
		return map[string]bool{"created": true}, nil
	case daemonrpc.MethodWorkspaceFileDiff:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileReadDiff(ctx, req.WorkspaceID, req.Path)
	case daemonrpc.MethodWorkspaceGitStatus:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitStatus(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitListChanges:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListChanges(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitTrack:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitTrackChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"tracked": true}, nil
	case daemonrpc.MethodWorkspaceGitUnstage:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitUnstageChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"unstaged": true}, nil
	case daemonrpc.MethodWorkspaceGitRevert:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRevertChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"reverted": true}, nil
	case daemonrpc.MethodWorkspaceGitCommit:
		var req gitCommitParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitCommitChanges(ctx, req.WorkspaceID, req.Message, req.Amend, req.Signoff)
	case daemonrpc.MethodWorkspaceGitBranchStatus:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitBranchStatus(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitCommitsToTarget:
		var req gitTargetBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListCommitsToTarget(ctx, req.WorkspaceID, req.TargetBranch)
	case daemonrpc.MethodWorkspaceGitCommitDiff:
		var req gitCommitDiffParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitReadCommitDiff(ctx, req.WorkspaceID, req.CommitHash, req.Path)
	case daemonrpc.MethodWorkspaceGitBranchDiff:
		var req gitBranchDiffParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitReadBranchComparisonDiff(ctx, req.WorkspaceID, req.TargetBranch, req.Path)
	case daemonrpc.MethodWorkspaceGitBranches:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListBranches(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitPush:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitPushBranch(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitPublish:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitPublishBranch(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceGitRenameBranch:
		var req gitRenameBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRenameBranch(ctx, req.WorkspaceID, req.NextBranch); err != nil {
			return nil, err
		}
		return map[string]bool{"renamed": true}, nil
	case daemonrpc.MethodWorkspaceGitRemoveBranch:
		var req gitRemoveBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRemoveBranch(ctx, req.WorkspaceID, req.Branch, req.Force); err != nil {
			return nil, err
		}
		return map[string]bool{"removed": true}, nil
	case daemonrpc.MethodWorkspaceGitWorktreeCreate:
		var req gitCreateWorktreeParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitCreateWorktree(ctx, req.WorkspaceID, req.Branch, req.WorktreePath, req.CreateBranch, req.FromRef); err != nil {
			return nil, err
		}
		return map[string]bool{"created": true}, nil
	case daemonrpc.MethodWorkspaceGitWorktreeRemove:
		var req gitRemoveWorktreeParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRemoveWorktree(ctx, req.WorkspaceID, req.WorktreePath, req.Force); err != nil {
			return nil, err
		}
		return map[string]bool{"removed": true}, nil
	case daemonrpc.MethodWorkspaceGitAuthorName:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitAuthorName(ctx, req.WorkspaceID)
	case daemonrpc.MethodWorkspaceTerminalStart:
		var req workspace.TerminalStartRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStart(ctx, req)
	case daemonrpc.MethodWorkspaceTerminalSend:
		var req workspace.TerminalSendRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalSend(req)
	case daemonrpc.MethodWorkspaceTerminalRead:
		var req workspace.TerminalReadRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalRead(req)
	case daemonrpc.MethodWorkspaceTerminalStop:
		var req workspace.TerminalStopRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStop(req)
	case daemonrpc.MethodWorkspaceTerminalResize:
		var req workspace.TerminalResizeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalResize(req)
	case daemonrpc.MethodWorkspaceTerminalSubscribe:
		var req workspace.TerminalSubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		subscription, err := h.manager.TerminalSubscribe(req)
		if err != nil {
			return nil, err
		}
		client.AttachSubscription(req.SessionID, subscription.ID, subscription.Events, func(sessionID string, subscriptionID uint64) {
			_, _ = h.manager.TerminalUnsubscribe(workspace.TerminalUnsubscribeRequest{SessionID: sessionID, SubscriptionID: subscriptionID})
		})
		return workspace.TerminalSubscribeResponse{Subscribed: true}, nil
	case daemonrpc.MethodWorkspaceTerminalUnsubscribe:
		var req workspace.TerminalUnsubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		client.DetachSubscription(req.SessionID)
		return workspace.TerminalUnsubscribeResponse{Unsubscribed: true}, nil
	default:
		return nil, workspace.NewRPCError(-32601, fmt.Sprintf("method not found: %s", method))
	}
}
