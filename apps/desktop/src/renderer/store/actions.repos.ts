import {
  buildCreatedRepoState,
  buildDeletedRepoState,
  buildHydratedStateFromSnapshot,
  buildUpdatedRepoConfigState,
  normalizeCreateRepoInput,
} from "../helpers/repoHelpers";
import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceRepoActions = Pick<
  WorkspaceStoreActions,
  "loadWorkspaceFromBackend" | "createRepo" | "deleteRepo" | "updateRepoConfig" | "incrementFileTreeRefreshVersion"
>;

/** Creates repo-related workspace store actions and reconciles backend snapshots with in-memory UI state. */
export function createWorkspaceRepoActions(
  set: WorkspaceStoreSetState,
  _get: WorkspaceStoreGetState,
): WorkspaceRepoActions {
  return {
    loadWorkspaceFromBackend: (snapshot, persistedDisplayRepoIds) => {
      set((state) => buildHydratedStateFromSnapshot(state, snapshot, persistedDisplayRepoIds));
    },
    createRepo: ({ name, source, path, gitUrl, backendRepo }) => {
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

      set((state) => ({
        ...buildCreatedRepoState(state, {
          name,
          source,
          normalizedPath,
          normalizedGitUrl,
          resolvedPath,
          backendRepo,
        }),
      }));
    },
    deleteRepo: (repoId) => {
      if (!repoId) {
        return;
      }

      set((state) => buildDeletedRepoState(state, repoId));
    },
    updateRepoConfig: (repoId, config) => {
      set((state) => ({
        ...buildUpdatedRepoConfigState(state, repoId, config),
      }));
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
