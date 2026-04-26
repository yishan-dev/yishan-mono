import { sessionStore } from "./sessionStore";
import type {
  WorkspaceStoreActions,
  WorkspaceStoreGetState,
  WorkspaceStoreSetState,
  WorkspaceStoreState,
} from "./types";

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

  const updateCurrentOrganizationPreferences = (
    state: WorkspaceStoreState,
    updater: (organizationPreferences: NonNullable<WorkspaceStoreState["organizationPreferencesById"]>[string]) => void,
  ): void => {
    const organizationId = sessionStore.getState().selectedOrganizationId?.trim();
    if (!organizationId) {
      return;
    }

    state.organizationPreferencesById ??= {};
    state.organizationPreferencesById[organizationId] ??= {};
    updater(state.organizationPreferencesById[organizationId]);
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

      set((state) => {
        state.selectedProjectId = projectId;
        state.selectedWorkspaceId = nextWorkspaceId;
        updateCurrentOrganizationPreferences(state, (organizationPreferences) => {
          organizationPreferences.selectedProjectId = projectId;
          organizationPreferences.selectedWorkspaceId = nextWorkspaceId;
        });
      });
    },
    setSelectedWorkspaceId: (workspaceId) => {
      set((state) => {
        state.selectedWorkspaceId = workspaceId;
        updateCurrentOrganizationPreferences(state, (organizationPreferences) => {
          organizationPreferences.selectedWorkspaceId = workspaceId;
        });
      });
    },
    setDisplayProjectIds: (projectIds) => {
      set((state) => {
        state.displayProjectIds = projectIds;
        updateCurrentOrganizationPreferences(state, (organizationPreferences) => {
          organizationPreferences.displayProjectIds = projectIds;
        });
      });
    },
    setLastUsedExternalAppId: (appId) => {
      set((state) => {
        state.lastUsedExternalAppId = appId;
        updateCurrentOrganizationPreferences(state, (organizationPreferences) => {
          organizationPreferences.lastUsedExternalAppId = appId;
        });
      });
    },
  };
}
