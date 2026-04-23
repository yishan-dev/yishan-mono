package daemon

import (
	"context"
	"encoding/json"
	"fmt"

	"yishan/apps/cli/internal/workspace"
)

func (h *JSONRPCHandler) dispatch(ctx context.Context, connState *wsConnState, method string, params json.RawMessage) (any, error) {
	switch method {
	case MethodDaemonPing:
		return map[string]string{"status": "ok"}, nil
	case MethodWorkspaceOpen:
		var req workspace.OpenRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.Open(req)
	case MethodWorkspaceList:
		return h.manager.List(), nil
	case MethodWorkspaceFileRead:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileRead(req.WorkspaceID, req.Path)
	case MethodWorkspaceFileList:
		var req fileListParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileList(req.WorkspaceID, req.Path)
	case MethodWorkspaceFileStat:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileStat(req.WorkspaceID, req.Path)
	case MethodWorkspaceFileWrite:
		var req fileWriteParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileWrite(req.WorkspaceID, req.Path, req.Content, req.Mode)
	case MethodWorkspaceFileDelete:
		var req fileDeleteParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileDelete(req.WorkspaceID, req.Path, req.Recursive); err != nil {
			return nil, err
		}
		return map[string]bool{"deleted": true}, nil
	case MethodWorkspaceFileMove:
		var req fileMoveParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileMove(req.WorkspaceID, req.FromPath, req.ToPath); err != nil {
			return nil, err
		}
		return map[string]bool{"moved": true}, nil
	case MethodWorkspaceFileMkdir:
		var req fileMkdirParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.FileMkdir(req.WorkspaceID, req.Path, req.Parents, req.Mode); err != nil {
			return nil, err
		}
		return map[string]bool{"created": true}, nil
	case MethodWorkspaceFileDiff:
		var req fileReadParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.FileReadDiff(ctx, req.WorkspaceID, req.Path)
	case MethodWorkspaceGitStatus:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitStatus(ctx, req.WorkspaceID)
	case MethodWorkspaceGitListChanges:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListChanges(ctx, req.WorkspaceID)
	case MethodWorkspaceGitTrack:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitTrackChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"tracked": true}, nil
	case MethodWorkspaceGitUnstage:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitUnstageChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"unstaged": true}, nil
	case MethodWorkspaceGitRevert:
		var req gitPathsParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRevertChanges(ctx, req.WorkspaceID, req.Paths); err != nil {
			return nil, err
		}
		return map[string]bool{"reverted": true}, nil
	case MethodWorkspaceGitCommit:
		var req gitCommitParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitCommitChanges(ctx, req.WorkspaceID, req.Message, req.Amend, req.Signoff)
	case MethodWorkspaceGitBranchStatus:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitBranchStatus(ctx, req.WorkspaceID)
	case MethodWorkspaceGitCommitsToTarget:
		var req gitTargetBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListCommitsToTarget(ctx, req.WorkspaceID, req.TargetBranch)
	case MethodWorkspaceGitCommitDiff:
		var req gitCommitDiffParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitReadCommitDiff(ctx, req.WorkspaceID, req.CommitHash, req.Path)
	case MethodWorkspaceGitBranchDiff:
		var req gitBranchDiffParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitReadBranchComparisonDiff(ctx, req.WorkspaceID, req.TargetBranch, req.Path)
	case MethodWorkspaceGitBranches:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitListBranches(ctx, req.WorkspaceID)
	case MethodWorkspaceGitPush:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitPushBranch(ctx, req.WorkspaceID)
	case MethodWorkspaceGitPublish:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitPublishBranch(ctx, req.WorkspaceID)
	case MethodWorkspaceGitRenameBranch:
		var req gitRenameBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRenameBranch(ctx, req.WorkspaceID, req.NextBranch); err != nil {
			return nil, err
		}
		return map[string]bool{"renamed": true}, nil
	case MethodWorkspaceGitRemoveBranch:
		var req gitRemoveBranchParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRemoveBranch(ctx, req.WorkspaceID, req.Branch, req.Force); err != nil {
			return nil, err
		}
		return map[string]bool{"removed": true}, nil
	case MethodWorkspaceGitWorktreeCreate:
		var req gitCreateWorktreeParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitCreateWorktree(ctx, req.WorkspaceID, req.Branch, req.WorktreePath, req.CreateBranch, req.FromRef); err != nil {
			return nil, err
		}
		return map[string]bool{"created": true}, nil
	case MethodWorkspaceGitWorktreeRemove:
		var req gitRemoveWorktreeParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		if err := h.manager.GitRemoveWorktree(ctx, req.WorkspaceID, req.WorktreePath, req.Force); err != nil {
			return nil, err
		}
		return map[string]bool{"removed": true}, nil
	case MethodWorkspaceGitAuthorName:
		var req gitStatusParams
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.GitAuthorName(ctx, req.WorkspaceID)
	case MethodWorkspaceTerminalStart:
		var req workspace.TerminalStartRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStart(ctx, req)
	case MethodWorkspaceTerminalSend:
		var req workspace.TerminalSendRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalSend(req)
	case MethodWorkspaceTerminalRead:
		var req workspace.TerminalReadRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalRead(req)
	case MethodWorkspaceTerminalStop:
		var req workspace.TerminalStopRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalStop(req)
	case MethodWorkspaceTerminalResize:
		var req workspace.TerminalResizeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		return h.manager.TerminalResize(req)
	case MethodWorkspaceTerminalSubscribe:
		var req workspace.TerminalSubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		subscription, err := h.manager.TerminalSubscribe(req)
		if err != nil {
			return nil, err
		}
		connState.AttachSubscription(req.SessionID, subscription.ID, subscription.Events, func(sessionID string, subscriptionID uint64) {
			_, _ = h.manager.TerminalUnsubscribe(workspace.TerminalUnsubscribeRequest{SessionID: sessionID, SubscriptionID: subscriptionID})
		})
		return workspace.TerminalSubscribeResponse{Subscribed: true}, nil
	case MethodWorkspaceTerminalUnsubscribe:
		var req workspace.TerminalUnsubscribeRequest
		if err := decodeParams(params, &req); err != nil {
			return nil, err
		}
		connState.DetachSubscription(req.SessionID)
		return workspace.TerminalUnsubscribeResponse{Unsubscribed: true}, nil
	default:
		return nil, workspace.NewRPCError(-32601, fmt.Sprintf("method not found: %s", method))
	}
}
