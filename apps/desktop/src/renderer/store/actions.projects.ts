import {
  buildCreatedRepoState,
  buildDeletedRepoState,
  buildHydratedStateFromSnapshot,
  buildUpdatedRepoConfigState,
  normalizeCreateRepoInput,
} from "../helpers/projectHelpers";
import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceRepoActions = Pick<
  WorkspaceStoreActions,
  | "loadWorkspaceFromBackend"
  | "createProject"
  | "createRepo"
  | "deleteProject"
  | "deleteRepo"
  | "updateProjectConfig"
  | "updateRepoConfig"
  | "incrementFileTreeRefreshVersion"
>;

/** Creates repo-related workspace store actions and reconciles backend snapshots with in-memory UI state. */
export function createWorkspaceRepoActions(
  set: WorkspaceStoreSetState,
  _get: WorkspaceStoreGetState,
): WorkspaceRepoActions {
  const applyRepoStateAliases = <T extends Record<string, unknown>>(
    state: { repos: unknown[]; selectedRepoId: string; displayRepoIds: string[] },
    partial: T,
  ): T & {
    projects: unknown[];
    selectedProjectId: string;
    displayProjectIds: string[];
  } => {
    const nextRepos = (partial.repos as unknown[] | undefined) ?? state.repos;
    const nextSelectedRepoId = (partial.selectedRepoId as string | undefined) ?? state.selectedRepoId;
    const nextDisplayRepoIds = (partial.displayRepoIds as string[] | undefined) ?? state.displayRepoIds;
    return {
      ...partial,
      projects: nextRepos,
      selectedProjectId: nextSelectedRepoId,
      displayProjectIds: nextDisplayRepoIds,
    };
  };

  const createProject = ({ name, source, path, gitUrl, backendRepo }: Parameters<WorkspaceStoreActions["createProject"]>[0]) => {
    const { normalizedPath, normalizedGitUrl, resolvedPath } = normalizeCreateRepoInput({
      path,
      gitUrl,
      source,
    });

    if (!name.trim() || !resolvedPath) {
      return;
    }

    if (!backendRepo?.id) {
      return;
    }

    set((state) =>
      applyRepoStateAliases(
        state,
        buildCreatedRepoState(state, {
          name,
          source,
          normalizedPath,
          normalizedGitUrl,
          resolvedPath,
          backendRepo,
        }),
      ),
    );
  };

  return {
    loadWorkspaceFromBackend: (snapshot, persistedDisplayRepoIds) => {
      set((state) => applyRepoStateAliases(state, buildHydratedStateFromSnapshot(state, snapshot, persistedDisplayRepoIds)));
    },
    createProject,
    createRepo: (input) => {
      createProject(input);
    },
    deleteProject: (projectId) => {
      if (!projectId) {
        return;
      }

      set((state) => applyRepoStateAliases(state, buildDeletedRepoState(state, projectId)));
    },
    deleteRepo: (repoId) => {
      if (!repoId) {
        return;
      }

      set((state) => applyRepoStateAliases(state, buildDeletedRepoState(state, repoId)));
    },
    updateProjectConfig: (projectId, config) => {
      set((state) => applyRepoStateAliases(state, buildUpdatedRepoConfigState(state, projectId, config)));
    },
    updateRepoConfig: (repoId, config) => {
      set((state) => applyRepoStateAliases(state, buildUpdatedRepoConfigState(state, repoId, config)));
    },
    incrementFileTreeRefreshVersion: (workspaceWorktreePath, changedRelativePaths) => {
      const normalizedWorkspaceWorktreePath = workspaceWorktreePath?.trim() ?? "";
      const normalizedChangedRelativePaths = (changedRelativePaths ?? [])
        .map((path) => path.trim())
        .filter((path) => path.length > 0);

      set((state) => ({
        fileTreeRefreshVersion: state.fileTreeRefreshVersion + 1,
        fileTreeChangedRelativePathsByWorktreePath:
          normalizedWorkspaceWorktreePath.length === 0
            ? state.fileTreeChangedRelativePathsByWorktreePath
            : {
                ...state.fileTreeChangedRelativePathsByWorktreePath,
                [normalizedWorkspaceWorktreePath]: normalizedChangedRelativePaths,
              },
      }));
    },
  };
}
