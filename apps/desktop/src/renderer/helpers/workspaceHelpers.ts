import type { WorkspaceStoreState } from "../store/types";

type WorkspaceStoreSlice = Pick<
  WorkspaceStoreState,
  | "projects"
  | "workspaces"
  | "selectedProjectId"
  | "selectedWorkspaceId"
  | "gitChangesCountByWorkspaceId"
  | "gitChangeTotalsByWorkspaceId"
>;

function resolveWorkspaceProjectId(workspace: { projectId?: string; repoId: string }): string {
  return workspace.projectId ?? workspace.repoId;
}

/** Returns normalized workspace naming and branch values. */
export function normalizeCreateWorkspaceInput(input: {
  name: string;
}): {
  normalizedName: string;
  normalizedTitle: string;
  normalizedBranch: string;
} {
  const normalizedName = input.name.trim();
  return {
    normalizedName,
    normalizedTitle: normalizedName,
    normalizedBranch: "main",
  };
}

/** Applies a newly created workspace to the draft state and updates selection. */
export function applyCreatedWorkspaceState(
  state: WorkspaceStoreSlice,
  input: {
    projectId: string;
    normalizedName: string;
    normalizedTitle: string;
    normalizedBranch: string;
    backendWorkspace: {
      workspaceId: string;
      organizationId?: string;
      name: string;
      sourceBranch: string;
      branch: string;
      worktreePath: string;
    };
  },
): void {
  const nextWorkspaceId = input.backendWorkspace.workspaceId;
  const nextWorkspace = {
    id: nextWorkspaceId,
    organizationId: input.backendWorkspace.organizationId,
    projectId: input.projectId,
    repoId: input.projectId,
    name: input.backendWorkspace.name || input.normalizedName,
    title: input.normalizedTitle,
    sourceBranch: input.backendWorkspace.sourceBranch || "",
    branch: input.backendWorkspace.branch || input.normalizedBranch,
    summaryId: nextWorkspaceId,
    worktreePath: input.backendWorkspace.worktreePath,
  };
  const existingWorkspaceIndex = state.workspaces.findIndex((workspace) => workspace.id === nextWorkspaceId);
  if (existingWorkspaceIndex >= 0) {
    Object.assign(state.workspaces[existingWorkspaceIndex], nextWorkspace);
  } else {
    state.workspaces.push(nextWorkspace);
  }

  state.selectedProjectId = input.projectId;
  state.selectedWorkspaceId = nextWorkspaceId;
}

/** Removes one workspace from draft state and recalculates selection. */
export function applyDeletedWorkspaceState(
  state: WorkspaceStoreSlice,
  input: { projectId: string; workspaceId: string },
): void {
  const removedIndex = state.workspaces.findIndex((workspace) => workspace.id === input.workspaceId);
  if (removedIndex >= 0) {
    state.workspaces.splice(removedIndex, 1);
  }

  delete state.gitChangesCountByWorkspaceId[input.workspaceId];
  delete state.gitChangeTotalsByWorkspaceId[input.workspaceId];

  if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0]?.id ?? "";
  }

  if (state.selectedWorkspaceId === input.workspaceId) {
    state.selectedWorkspaceId =
      state.workspaces.find((workspace) => resolveWorkspaceProjectId(workspace) === input.projectId)?.id ??
      state.workspaces[0]?.id ??
      "";
  }
}

/** Applies a workspace rename to the matching workspace in draft state. */
export function applyRenamedWorkspaceState(
  state: Pick<WorkspaceStoreState, "workspaces">,
  input: { projectId: string; workspaceId: string; normalizedName: string },
): void {
  const workspace = state.workspaces.find(
    (workspace) => workspace.id === input.workspaceId && resolveWorkspaceProjectId(workspace) === input.projectId,
  );
  if (workspace) {
    workspace.name = input.normalizedName;
    workspace.title = input.normalizedName;
  }
}

/** Applies a workspace branch rename to the matching workspace in draft state. */
export function applyRenamedWorkspaceBranchState(
  state: Pick<WorkspaceStoreState, "workspaces">,
  input: { projectId: string; workspaceId: string; normalizedBranch: string },
): void {
  const workspace = state.workspaces.find(
    (workspace) => workspace.id === input.workspaceId && resolveWorkspaceProjectId(workspace) === input.projectId,
  );
  if (workspace) {
    workspace.branch = input.normalizedBranch;
  }
}

/** Counts changed files from staged, unstaged, and untracked groups. */
export function countWorkspaceGitChanges(sections: {
  staged: unknown[];
  unstaged: unknown[];
  untracked: unknown[];
}): number {
  return sections.staged.length + sections.unstaged.length + sections.untracked.length;
}

/** Sums additions and deletions across staged, unstaged, and untracked file sections. */
export function summarizeWorkspaceGitChangeTotals(sections: {
  staged: Array<{ additions: number; deletions: number }>;
  unstaged: Array<{ additions: number; deletions: number }>;
  untracked: Array<{ additions: number; deletions: number }>;
}): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const section of [sections.staged, sections.unstaged, sections.untracked]) {
    for (const file of section) {
      additions += Math.max(0, file.additions);
      deletions += Math.max(0, file.deletions);
    }
  }

  return {
    additions,
    deletions,
  };
}
