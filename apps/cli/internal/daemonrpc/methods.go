package daemonrpc

const (
	MethodDaemonPing = "daemon.ping"

	MethodWorkspaceOpen = "workspace.open"
	MethodWorkspaceList = "workspace.list"

	MethodWorkspaceFileRead   = "workspace.file.read"
	MethodWorkspaceFileList   = "workspace.file.list"
	MethodWorkspaceFileStat   = "workspace.file.stat"
	MethodWorkspaceFileWrite  = "workspace.file.write"
	MethodWorkspaceFileDelete = "workspace.file.delete"
	MethodWorkspaceFileMove   = "workspace.file.move"
	MethodWorkspaceFileMkdir  = "workspace.file.mkdir"
	MethodWorkspaceFileDiff   = "workspace.file.diff"

	MethodWorkspaceGitStatus          = "workspace.git.status"
	MethodWorkspaceGitListChanges     = "workspace.git.listChanges"
	MethodWorkspaceGitTrack           = "workspace.git.track"
	MethodWorkspaceGitUnstage         = "workspace.git.unstage"
	MethodWorkspaceGitRevert          = "workspace.git.revert"
	MethodWorkspaceGitCommit          = "workspace.git.commit"
	MethodWorkspaceGitBranchStatus    = "workspace.git.branchStatus"
	MethodWorkspaceGitCommitsToTarget = "workspace.git.commitsToTarget"
	MethodWorkspaceGitCommitDiff      = "workspace.git.commitDiff"
	MethodWorkspaceGitBranchDiff      = "workspace.git.branchDiff"
	MethodWorkspaceGitBranches        = "workspace.git.branches"
	MethodWorkspaceGitPush            = "workspace.git.push"
	MethodWorkspaceGitPublish         = "workspace.git.publish"
	MethodWorkspaceGitRenameBranch    = "workspace.git.renameBranch"
	MethodWorkspaceGitRemoveBranch    = "workspace.git.removeBranch"

	MethodWorkspaceGitWorktreeCreate = "workspace.git.worktree.create"
	MethodWorkspaceGitWorktreeRemove = "workspace.git.worktree.remove"
	MethodWorkspaceGitAuthorName     = "workspace.git.authorName"

	MethodWorkspaceTerminalStart       = "workspace.terminal.start"
	MethodWorkspaceTerminalSend        = "workspace.terminal.send"
	MethodWorkspaceTerminalRead        = "workspace.terminal.read"
	MethodWorkspaceTerminalStop        = "workspace.terminal.stop"
	MethodWorkspaceTerminalResize      = "workspace.terminal.resize"
	MethodWorkspaceTerminalSubscribe   = "workspace.terminal.subscribe"
	MethodWorkspaceTerminalUnsubscribe = "workspace.terminal.unsubscribe"
)
