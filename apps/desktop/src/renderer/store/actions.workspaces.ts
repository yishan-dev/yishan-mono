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
  const resolveProjectId = (input: { projectId?: string; repoId?: string }): string => {
    return input.projectId ?? input.repoId ?? "";
  };

  return {
    addWorkspace: ({ organizationId, projectId, repoId, name, sourceBranch, branch, worktreePath, workspaceId }) => {
      if (!workspaceId) {
        return;
      }

      const resolvedProjectId = resolveProjectId({ projectId, repoId });
      if (!resolvedProjectId) {
        return;
      }

      set((state) => ({
        ...buildCreatedWorkspaceState(state, {
          projectId: resolvedProjectId,
          normalizedName: name,
          normalizedTitle: name,
          normalizedBranch: branch,
          backendWorkspace: {
            workspaceId,
            organizationId,
            name,
            sourceBranch,
            branch,
            worktreePath: worktreePath ?? "",
          },
        }),
      }));
    },
    deleteWorkspace: ({ projectId, repoId, workspaceId }) => {
      const resolvedProjectId = resolveProjectId({ projectId, repoId });
      if (!resolvedProjectId || !workspaceId) {
        return;
      }

      set((state) =>
        buildDeletedWorkspaceState(state, {
          projectId: resolvedProjectId,
          workspaceId,
        }),
      );
    },
    renameWorkspace: ({ projectId, repoId, workspaceId, name }) => {
      const normalizedName = name.trim();
      const resolvedProjectId = resolveProjectId({ projectId, repoId });
      if (!resolvedProjectId || !workspaceId || !normalizedName) {
        return;
      }

      set((state) => ({
        ...buildRenamedWorkspaceState(state, {
          projectId: resolvedProjectId,
          workspaceId,
          normalizedName,
        }),
      }));
    },
    renameWorkspaceBranch: ({ projectId, repoId, workspaceId, branch }) => {
      const normalizedBranch = branch.trim();
      const resolvedProjectId = resolveProjectId({ projectId, repoId });
      if (!resolvedProjectId || !workspaceId || !normalizedBranch) {
        return;
      }

      set((state) => ({
        ...buildRenamedWorkspaceBranchState(state, {
          projectId: resolvedProjectId,
          workspaceId,
          normalizedBranch,
        }),
      }));
    },
    setWorkspaceGitChangesCount: (workspaceId, count) => {
      if (!workspaceId) {
        return;
      }

      set((state) => {
        state.gitChangesCountByWorkspaceId[workspaceId] = count;
      });
    },
    setWorkspaceGitChangeTotals: (workspaceId, totals) => {
      if (!workspaceId) {
        return;
      }

      set((state) => {
        state.gitChangeTotalsByWorkspaceId[workspaceId] = {
          additions: Math.max(0, totals.additions),
          deletions: Math.max(0, totals.deletions),
        };
      });
    },
    incrementGitRefreshVersion: (workspaceWorktreePath) => {
      const normalizedWorkspaceWorktreePath = workspaceWorktreePath.trim();
      if (!normalizedWorkspaceWorktreePath) {
        return;
      }

      set((state) => {
        state.gitRefreshVersionByWorktreePath[normalizedWorkspaceWorktreePath] =
          (state.gitRefreshVersionByWorktreePath[normalizedWorkspaceWorktreePath] ?? 0) + 1;
      });
    },
  };
}
