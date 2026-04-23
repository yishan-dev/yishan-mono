import type { Repo, RepoWorkspaceItem, WorkspaceStorePersistedState, WorkspaceStoreState } from "./types";

/** Builds workspace store state from backend snapshot data without creating implicit tabs. */
export function buildWorkspaceStateFromData(input: {
  repos: Repo[];
  workspaces: RepoWorkspaceItem[];
  preferredRepoId?: string;
  preferredWorkspaceId?: string;
}): Pick<WorkspaceStoreState, "repos" | "workspaces" | "selectedRepoId" | "selectedWorkspaceId"> {
  const preferredRepoExists = input.preferredRepoId && input.repos.some((repo) => repo.id === input.preferredRepoId);
  const selectedRepoId = preferredRepoExists ? (input.preferredRepoId as string) : (input.repos[0]?.id ?? "");
  const preferredWorkspaceBelongsToSelectedRepo =
    input.preferredWorkspaceId &&
    input.workspaces.some(
      (workspace) => workspace.id === input.preferredWorkspaceId && workspace.repoId === selectedRepoId,
    );
  const selectedWorkspaceId = preferredWorkspaceBelongsToSelectedRepo
    ? (input.preferredWorkspaceId as string)
    : (input.workspaces.find((workspace) => workspace.repoId === selectedRepoId)?.id ?? "");

  return {
    repos: input.repos,
    workspaces: input.workspaces,
    selectedRepoId,
    selectedWorkspaceId,
  };
}

export const initialWorkspaceState = buildWorkspaceStateFromData({
  repos: [],
  workspaces: [],
});

export function partializeWorkspaceState(state: WorkspaceStoreState): WorkspaceStorePersistedState {
  return {
    displayRepoIds: state.displayRepoIds,
    lastUsedExternalAppId: state.lastUsedExternalAppId,
  };
}
