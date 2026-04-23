import type { Repo, RepoWorkspaceItem, WorkspaceStorePersistedState, WorkspaceStoreState } from "./types";

/** Builds workspace store state from backend snapshot data without creating implicit tabs. */
export function buildWorkspaceStateFromData(input: {
  repos: Repo[];
  workspaces: RepoWorkspaceItem[];
  preferredRepoId?: string;
  preferredWorkspaceId?: string;
}): Pick<
  WorkspaceStoreState,
  "projects" | "repos" | "workspaces" | "selectedProjectId" | "selectedRepoId" | "selectedWorkspaceId"
> {
  const resolveWorkspaceProjectId = (workspace: RepoWorkspaceItem): string => {
    return workspace.projectId ?? workspace.repoId;
  };
  const preferredRepoExists = input.preferredRepoId && input.repos.some((repo) => repo.id === input.preferredRepoId);
  const selectedRepoId = preferredRepoExists ? (input.preferredRepoId as string) : (input.repos[0]?.id ?? "");
  const preferredWorkspaceBelongsToSelectedRepo =
    input.preferredWorkspaceId &&
    input.workspaces.some(
      (workspace) => workspace.id === input.preferredWorkspaceId && resolveWorkspaceProjectId(workspace) === selectedRepoId,
    );
  const selectedWorkspaceId = preferredWorkspaceBelongsToSelectedRepo
    ? (input.preferredWorkspaceId as string)
    : (input.workspaces.find((workspace) => resolveWorkspaceProjectId(workspace) === selectedRepoId)?.id ?? "");

  return {
    projects: input.repos,
    repos: input.repos,
    workspaces: input.workspaces,
    selectedProjectId: selectedRepoId,
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
    displayProjectIds: state.displayProjectIds,
    displayRepoIds: state.displayRepoIds,
    lastUsedExternalAppId: state.lastUsedExternalAppId,
  };
}
