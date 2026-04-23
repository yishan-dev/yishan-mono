import {
  buildCreatedWorkspaceState,
  buildDeletedWorkspaceState,
  buildRenamedWorkspaceBranchState,
  buildRenamedWorkspaceState,
} from "../helpers/workspaceHelpers";
import type { WorkspaceStoreActions, WorkspaceStoreGetState, WorkspaceStoreSetState } from "./types";

type WorkspaceActions = Pick<
  WorkspaceStoreActions,
  | "addWorkspace"
  | "deleteWorkspace"
  | "renameWorkspace"
  | "renameWorkspaceBranch"
  | "setWorkspaceGitChangesCount"
  | "setWorkspaceGitChangeTotals"
  | "incrementGitRefreshVersion"
>;

/** Creates, renames, and deletes workspaces while keeping selection state in sync. */
export function createWorkspaceActions(set: WorkspaceStoreSetState, _get: WorkspaceStoreGetState): WorkspaceActions {
  return {
    addWorkspace: ({ repoId, name, sourceBranch, branch, worktreePath, workspaceId }) => {
      if (!workspaceId) {
        return;
      }

      set((state) => ({
        ...buildCreatedWorkspaceState(state, {
          repoId,
          normalizedName: name,
          normalizedTitle: name,
          normalizedBranch: branch,
          backendWorkspace: {
            workspaceId,
            name,
            sourceBranch,
            branch,
            worktreePath: worktreePath ?? "",
          },
        }),
      }));
    },
    deleteWorkspace: ({ repoId, workspaceId }) => {
      if (!repoId || !workspaceId) {
        return;
      }

      set((state) =>
        buildDeletedWorkspaceState(state, {
          repoId,
          workspaceId,
        }),
      );
    },
    renameWorkspace: ({ repoId, workspaceId, name }) => {
      const normalizedName = name.trim();
      if (!repoId || !workspaceId || !normalizedName) {
        return;
      }

      set((state) => ({
        ...buildRenamedWorkspaceState(state, {
          repoId,
          workspaceId,
          normalizedName,
        }),
      }));
    },
    renameWorkspaceBranch: ({ repoId, workspaceId, branch }) => {
      const normalizedBranch = branch.trim();
      if (!repoId || !workspaceId || !normalizedBranch) {
        return;
      }

      set((state) => ({
        ...buildRenamedWorkspaceBranchState(state, {
          repoId,
          workspaceId,
          normalizedBranch,
        }),
      }));
    },
    setWorkspaceGitChangesCount: (workspaceId, count) => {
      if (!workspaceId) {
        return;
      }

      set((state) => ({
        gitChangesCountByWorkspaceId: {
          ...state.gitChangesCountByWorkspaceId,
          [workspaceId]: count,
        },
      }));
    },
    setWorkspaceGitChangeTotals: (workspaceId, totals) => {
      if (!workspaceId) {
        return;
      }

      set((state) => ({
        gitChangeTotalsByWorkspaceId: {
          ...state.gitChangeTotalsByWorkspaceId,
          [workspaceId]: {
            additions: Math.max(0, totals.additions),
            deletions: Math.max(0, totals.deletions),
          },
        },
      }));
    },
    incrementGitRefreshVersion: (workspaceWorktreePath) => {
      const normalizedWorkspaceWorktreePath = workspaceWorktreePath.trim();
      if (!normalizedWorkspaceWorktreePath) {
        return;
      }

      set((state) => ({
        gitRefreshVersionByWorktreePath: {
          ...state.gitRefreshVersionByWorktreePath,
          [normalizedWorkspaceWorktreePath]:
            (state.gitRefreshVersionByWorktreePath[normalizedWorkspaceWorktreePath] ?? 0) + 1,
        },
      }));
    },
  };
}
