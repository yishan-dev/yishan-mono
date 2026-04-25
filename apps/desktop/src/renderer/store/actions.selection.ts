import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceSelectionActions = Pick<
  WorkspaceStoreActions,
  | "setSelectedProjectId"
  | "setSelectedWorkspaceId"
  | "setDisplayProjectIds"
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
        selectedWorkspaceId: nextWorkspaceId,
      });
    },
    setSelectedWorkspaceId: (workspaceId) => {
      set({ selectedWorkspaceId: workspaceId });
    },
    setDisplayProjectIds: (projectIds) => {
      set({
        displayProjectIds: projectIds
      });
    },
    setLastUsedExternalAppId: (appId) => {
      set({
        lastUsedExternalAppId: appId,
      });
    },
  };
}
