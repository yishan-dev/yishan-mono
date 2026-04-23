import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceSelectionActions = Pick<
  WorkspaceStoreActions,
  | "setSelectedProjectId"
  | "setSelectedRepoId"
  | "setSelectedWorkspaceId"
  | "setDisplayProjectIds"
  | "setDisplayRepoIds"
  | "setLastUsedExternalAppId"
>;

export function createWorkspaceSelectionActions(
  set: WorkspaceStoreSetState,
  get: WorkspaceStoreGetState,
): WorkspaceSelectionActions {
  const resolveWorkspaceProjectId = (workspace: { projectId?: string; repoId: string }): string => {
    return workspace.projectId ?? workspace.repoId;
  };

  return {
    setSelectedProjectId: (projectId) => {
      const { selectedWorkspaceId, workspaces } = get();
      const workspaceBelongsToProject = workspaces.some(
        (workspace) => workspace.id === selectedWorkspaceId && resolveWorkspaceProjectId(workspace) === projectId,
      );
      const nextWorkspaceId = workspaceBelongsToProject
        ? selectedWorkspaceId
        : (workspaces.find((workspace) => resolveWorkspaceProjectId(workspace) === projectId)?.id ?? "");

      set({
        selectedProjectId: projectId,
        selectedRepoId: projectId,
        selectedWorkspaceId: nextWorkspaceId,
      });
    },
    setSelectedRepoId: (repoId) => {
      const { selectedWorkspaceId, workspaces } = get();
      const workspaceBelongsToRepo = workspaces.some(
        (workspace) => workspace.id === selectedWorkspaceId && resolveWorkspaceProjectId(workspace) === repoId,
      );
      const nextWorkspaceId = workspaceBelongsToRepo
        ? selectedWorkspaceId
        : (workspaces.find((workspace) => resolveWorkspaceProjectId(workspace) === repoId)?.id ?? "");

      set({
        selectedProjectId: repoId,
        selectedRepoId: repoId,
        selectedWorkspaceId: nextWorkspaceId,
      });
    },
    setSelectedWorkspaceId: (workspaceId) => {
      set({ selectedWorkspaceId: workspaceId });
    },
    setDisplayProjectIds: (projectIds) => {
      set({
        displayProjectIds: projectIds,
        displayRepoIds: projectIds,
      });
    },
    setDisplayRepoIds: (repoIds) => {
      set({
        displayProjectIds: repoIds,
        displayRepoIds: repoIds,
      });
    },
    setLastUsedExternalAppId: (appId) => {
      set({
        lastUsedExternalAppId: appId,
      });
    },
  };
}
