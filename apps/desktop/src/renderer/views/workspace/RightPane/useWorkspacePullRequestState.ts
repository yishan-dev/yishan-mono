import { workspaceStore } from "../../../store/workspaceStore";

/** Returns pull request state for the currently selected workspace from the renderer store. */
export function useWorkspacePullRequestState(_enabled = true) {
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const pullRequest = workspaceStore((state) => state.pullRequestByWorkspaceId[state.selectedWorkspaceId]);

  return {
    selectedWorkspaceId,
    pullRequest,
    isLoading: false,
  };
}
