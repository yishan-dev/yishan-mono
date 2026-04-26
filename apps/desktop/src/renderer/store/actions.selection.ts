import { sessionStore } from "./sessionStore";
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
        organizationPreferencesById: (() => {
          const organizationId = sessionStore.getState().selectedOrganizationId?.trim();
          if (!organizationId) {
            return get().organizationPreferencesById;
          }

          return {
            ...(get().organizationPreferencesById ?? {}),
            [organizationId]: {
              ...(get().organizationPreferencesById?.[organizationId] ?? {}),
              selectedProjectId: projectId,
              selectedWorkspaceId: nextWorkspaceId,
            },
          };
        })(),
      });
    },
    setSelectedWorkspaceId: (workspaceId) => {
      set({
        selectedWorkspaceId: workspaceId,
        organizationPreferencesById: (() => {
          const organizationId = sessionStore.getState().selectedOrganizationId?.trim();
          if (!organizationId) {
            return get().organizationPreferencesById;
          }

          return {
            ...(get().organizationPreferencesById ?? {}),
            [organizationId]: {
              ...(get().organizationPreferencesById?.[organizationId] ?? {}),
              selectedWorkspaceId: workspaceId,
            },
          };
        })(),
      });
    },
    setDisplayProjectIds: (projectIds) => {
      set({
        displayProjectIds: projectIds,
        organizationPreferencesById: (() => {
          const organizationId = sessionStore.getState().selectedOrganizationId?.trim();
          if (!organizationId) {
            return get().organizationPreferencesById;
          }

          return {
            ...(get().organizationPreferencesById ?? {}),
            [organizationId]: {
              ...(get().organizationPreferencesById?.[organizationId] ?? {}),
              displayProjectIds: projectIds,
            },
          };
        })(),
      });
    },
    setLastUsedExternalAppId: (appId) => {
      set({
        lastUsedExternalAppId: appId,
        organizationPreferencesById: (() => {
          const organizationId = sessionStore.getState().selectedOrganizationId?.trim();
          if (!organizationId) {
            return get().organizationPreferencesById;
          }

          return {
            ...(get().organizationPreferencesById ?? {}),
            [organizationId]: {
              ...(get().organizationPreferencesById?.[organizationId] ?? {}),
              lastUsedExternalAppId: appId,
            },
          };
        })(),
      });
    },
  };
}
