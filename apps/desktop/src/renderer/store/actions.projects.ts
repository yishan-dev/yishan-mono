import {
  buildCreatedRepoState,
  buildDeletedRepoState,
  buildHydratedStateFromApiData,
  buildUpdatedRepoConfigState,
  normalizeCreateRepoInput,
} from "../helpers/projectHelpers";
import { sessionStore } from "./sessionStore";
import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceRepoActions = Pick<
  WorkspaceStoreActions,
  | "load"
  | "createProject"
  | "deleteProject"
  | "updateProjectConfig"
  | "incrementFileTreeRefreshVersion"
>;

function isGitInternalPath(path: string): boolean {
  return path === ".git" || path.startsWith(".git/");
}

/** Creates project-related workspace store actions and reconciles backend snapshots with in-memory UI state. */
export function createWorkspaceRepoActions(
  set: WorkspaceStoreSetState,
  _get: WorkspaceStoreGetState,
): WorkspaceRepoActions {
  const createProject = ({
    name,
    source,
    path,
    gitUrl,
    backendProject,
  }: Parameters<WorkspaceStoreActions["createProject"]>[0]) => {
    const { normalizedPath, normalizedGitUrl, resolvedPath } = normalizeCreateRepoInput({
      path,
      gitUrl,
      source,
    });

    if (!name.trim() || !resolvedPath) {
      return;
    }

    if (!backendProject?.id) {
      return;
    }

    const organizationId = sessionStore.getState().selectedOrganizationId?.trim() ?? "";

    set((state) => {
      const nextPartial = buildCreatedRepoState(state, {
        name,
        source,
        normalizedPath,
        normalizedGitUrl,
        resolvedPath,
        backendProject,
      });

      // Ensure newly-created projects persist selection + display preferences.
      // Existing selection flows call `setSelectedProjectId` / `setDisplayProjectIds`,
      // but createProject previously bypassed organization-scoped preferences.
      if (organizationId) {
        const nextSelectedProjectId = nextPartial.selectedProjectId ?? state.selectedProjectId;
        const nextSelectedWorkspaceId = nextPartial.selectedWorkspaceId ?? state.selectedWorkspaceId;
        const nextDisplayProjectIds = nextPartial.displayProjectIds ?? state.displayProjectIds;

        return {
          ...nextPartial,
          organizationPreferencesById: {
            ...(state.organizationPreferencesById ?? {}),
            [organizationId]: {
              ...(state.organizationPreferencesById?.[organizationId] ?? {}),
              selectedProjectId: nextSelectedProjectId,
              selectedWorkspaceId: nextSelectedWorkspaceId,
              displayProjectIds: nextDisplayProjectIds,
            },
          },
        };
      }

      return nextPartial;
    });
  };

  return {
    load: (organizationId, projects, workspaces) => {
      set((state) => {
        Object.assign(state, buildHydratedStateFromApiData(state, organizationId, projects, workspaces));
      });
    },
    createProject,
    deleteProject: (projectId) => {
      if (!projectId) {
        return;
      }

      set((state) => buildDeletedRepoState(state, projectId));
    },
    updateProjectConfig: (projectId, config) => {
      set((state) => buildUpdatedRepoConfigState(state, projectId, config));
    },
    incrementFileTreeRefreshVersion: (workspaceWorktreePath, changedRelativePaths) => {
      const normalizedWorkspaceWorktreePath = workspaceWorktreePath?.trim() ?? "";
      const normalizedChangedRelativePaths = (changedRelativePaths ?? [])
        .map((path) => path.trim())
        .filter((path) => path.length > 0 && !isGitInternalPath(path));

      set((state) => {
        state.fileTreeRefreshVersion += 1;
        if (normalizedWorkspaceWorktreePath.length === 0) {
          return;
        }

        state.fileTreeChangedRelativePathsByWorktreePath[normalizedWorkspaceWorktreePath] = normalizedChangedRelativePaths;
      });
    },
  };
}
