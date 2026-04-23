import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceSelectionActions = Pick<
  WorkspaceStoreActions,
  "setSelectedRepoId" | "setSelectedWorkspaceId" | "setDisplayRepoIds" | "setLastUsedExternalAppId"
>;

export function createWorkspaceSelectionActions(
  set: WorkspaceStoreSetState,
  get: WorkspaceStoreGetState,
): WorkspaceSelectionActions {
  return {
    setSelectedRepoId: (repoId) => {
      const { selectedWorkspaceId, workspaces } = get();
      const workspaceBelongsToRepo = workspaces.some(
        (workspace) => workspace.id === selectedWorkspaceId && workspace.repoId === repoId,
      );
      const nextWorkspaceId = workspaceBelongsToRepo
        ? selectedWorkspaceId
        : (workspaces.find((workspace) => workspace.repoId === repoId)?.id ?? "");

      set({
        selectedRepoId: repoId,
        selectedWorkspaceId: nextWorkspaceId,
      });
    },
    setSelectedWorkspaceId: (workspaceId) => {
      set({ selectedWorkspaceId: workspaceId });
    },
    setDisplayRepoIds: (repoIds) => {
      set({
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
