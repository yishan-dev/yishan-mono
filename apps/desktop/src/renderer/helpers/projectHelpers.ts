import { buildWorkspaceStateFromData } from "../store/state";
import { getFileName } from "../store/tabs";
import type { Repo, RepoWorkspaceItem, WorkspaceStoreState } from "../store/types";
import type { CreateRepoResult, RepoSnapshot } from "../types/projectTypes";

type RepoStoreSlice = Pick<
  WorkspaceStoreState,
  | "projects"
  | "repos"
  | "workspaces"
  | "gitChangesCountByWorkspaceId"
  | "gitChangeTotalsByWorkspaceId"
  | "selectedProjectId"
  | "selectedRepoId"
  | "selectedWorkspaceId"
  | "displayProjectIds"
  | "displayRepoIds"
>;

/** Builds one deterministic local-workspace id for a repository id. */
function buildLocalWorkspaceId(repoId: string): string {
  return `local-${repoId}`;
}

/** Returns the user-facing label for one default local workspace row. */
function getDefaultLocalWorkspaceLabel(): string {
  return "local";
}

/** Builds one local workspace row that points at the repository local path. */
function buildLocalWorkspaceItem(repo: Repo): RepoWorkspaceItem | null {
  const localPath = repo.localPath?.trim() ?? "";
  if (!localPath) {
    return null;
  }

  const defaultBranch = repo.defaultBranch?.trim() || "main";
  const workspaceId = buildLocalWorkspaceId(repo.id);
  const localWorkspaceLabel = getDefaultLocalWorkspaceLabel();
  return {
    id: workspaceId,
    projectId: repo.id,
    repoId: repo.id,
    name: localWorkspaceLabel,
    title: localWorkspaceLabel,
    sourceBranch: defaultBranch,
    branch: defaultBranch,
    summaryId: workspaceId,
    worktreePath: localPath,
    kind: "local",
  };
}

type RepoConfigUpdate = Pick<
  Repo,
  "name" | "worktreePath" | "privateContextEnabled" | "icon" | "iconBgColor" | "setupScript" | "postScript"
>;

/** Returns persisted repo display ids from local storage when available. */
export function readPersistedDisplayRepoIds(storage: Storage | undefined): string[] | undefined {
  if (!storage) {
    return undefined;
  }

  try {
    const raw = storage.getItem("yishan-workspace-store");
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as {
      state?: {
        displayProjectIds?: unknown;
        displayRepoIds?: unknown;
      };
    };
    const candidate = parsed.state?.displayProjectIds ?? parsed.state?.displayRepoIds;
    return Array.isArray(candidate) ? candidate.filter((item): item is string => typeof item === "string") : undefined;
  } catch {
    return undefined;
  }
}

/** Returns only entries keyed by workspace ids that still exist after snapshot reconciliation. */
function filterWorkspaceScopedRecord<T>(record: Record<string, T>, workspaceIdSet: Set<string>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([workspaceId]) => workspaceIdSet.has(workspaceId)),
  ) as Record<string, T>;
}

/** Maps backend snapshot data into workspace repos and open workspaces. */
function mapSnapshot(snapshot: RepoSnapshot): { repos: Repo[]; workspaces: RepoWorkspaceItem[] } {
  const repos = snapshot.repos.map((repo) => {
    const path = repo.localPath ?? "";
    const displayName = repo.name?.trim() || (path ? getFileName(path) : repo.id);
    return {
      id: repo.id,
      key: repo.key ?? repo.id,
      name: displayName,
      path,
      missing: !path,
      gitUrl: repo.gitUrl ?? repo.repoUrl ?? "",
      localPath: path,
      worktreePath: repo.worktreePath ?? path,
      privateContextEnabled: repo.privateContextEnabled ?? repo.contextEnabled ?? true,
      defaultBranch: repo.defaultBranch ?? "",
      icon: repo.icon ?? "folder",
      iconBgColor: repo.color ?? "#1E66F5",
      setupScript: repo.setupScript ?? "",
      postScript: repo.postScript ?? "",
    } satisfies Repo;
  });

  const repoIdSet = new Set(repos.map((repo) => repo.id));
  const managedWorkspaces = snapshot.workspaces
    .filter((workspace) => {
      const parentId = workspace.projectId ?? workspace.repoId ?? "";
      const status = workspace.status ?? "open";
      return repoIdSet.has(parentId) && status !== "closed";
    })
    .map(
      (workspace) =>
        ({
          id: workspace.workspaceId,
          projectId: workspace.projectId ?? workspace.repoId ?? "",
          repoId: workspace.projectId ?? workspace.repoId ?? "",
          name: workspace.name ?? workspace.branch ?? "workspace",
          title:
            workspace.name || getFileName(workspace.worktreePath ?? workspace.localPath ?? "") || workspace.branch || "workspace",
          sourceBranch: workspace.sourceBranch ?? workspace.branch ?? "main",
          branch: workspace.branch ?? workspace.sourceBranch ?? "main",
          summaryId: workspace.workspaceId,
          worktreePath: workspace.worktreePath ?? workspace.localPath,
          kind: "managed",
        }) satisfies RepoWorkspaceItem,
    );

  const localWorkspaces = repos
    .map((repo) => buildLocalWorkspaceItem(repo))
    .filter((workspace): workspace is RepoWorkspaceItem => workspace !== null);

  const workspaces = [...localWorkspaces, ...managedWorkspaces];

  return {
    repos,
    workspaces,
  };
}

/** Reconciles current state with backend snapshot while preserving compatible UI-only state. */
export function buildHydratedStateFromSnapshot(
  state: RepoStoreSlice,
  snapshot: RepoSnapshot,
  persistedDisplayRepoIds: string[] | undefined,
): Partial<RepoStoreSlice> {
  const { repos, workspaces } = mapSnapshot(snapshot);
  const nextBaseState = buildWorkspaceStateFromData({
    repos,
    workspaces,
    preferredRepoId: state.selectedRepoId,
    preferredWorkspaceId: state.selectedWorkspaceId,
  });
  const nextRepoIdSet = new Set(repos.map((repo) => repo.id));
  const baseDisplayRepoIds = persistedDisplayRepoIds ?? state.displayProjectIds ?? state.displayRepoIds;
  const nextDisplayRepoIds =
    persistedDisplayRepoIds === undefined && baseDisplayRepoIds.length === 0
      ? repos.map((repo) => repo.id)
      : baseDisplayRepoIds.filter((repoId) => nextRepoIdSet.has(repoId));
  const nextWorkspaceIdSet = new Set(workspaces.map((workspace) => workspace.id));

  return {
    ...nextBaseState,
    displayProjectIds: nextDisplayRepoIds,
    displayRepoIds: nextDisplayRepoIds,
    gitChangesCountByWorkspaceId: filterWorkspaceScopedRecord(state.gitChangesCountByWorkspaceId, nextWorkspaceIdSet),
    gitChangeTotalsByWorkspaceId: filterWorkspaceScopedRecord(state.gitChangeTotalsByWorkspaceId, nextWorkspaceIdSet),
  };
}

/** Normalizes create-repo input and returns empty strings when invalid. */
export function normalizeCreateRepoInput(input: {
  path?: string;
  gitUrl?: string;
  source: "local" | "remote";
}): { normalizedPath: string; normalizedGitUrl: string; resolvedPath: string } {
  const normalizedPath = input.path?.trim() ?? "";
  const normalizedGitUrl = input.gitUrl?.trim() ?? "";
  return {
    normalizedPath,
    normalizedGitUrl,
    resolvedPath: input.source === "local" ? normalizedPath : normalizedGitUrl || normalizedPath,
  };
}

/** Builds optimistic local state for a newly created repo. */
export function buildCreatedRepoState(
  state: RepoStoreSlice,
  input: {
    name: string;
    source: "local" | "remote";
    normalizedPath: string;
    normalizedGitUrl: string;
    resolvedPath: string;
    backendRepo: CreateRepoResult;
  },
): Partial<RepoStoreSlice> {
  const currentProjects = state.projects ?? state.repos;
  const currentDisplayProjectIds = state.displayProjectIds ?? state.displayRepoIds;
  const nextRepoId = input.backendRepo.id;
  const repoPath = input.backendRepo.localPath ?? input.resolvedPath;
  const nextProject = {
    id: nextRepoId,
    key: input.backendRepo.key ?? nextRepoId,
    name: input.name.trim(),
    path: repoPath,
    missing: false,
    gitUrl: input.backendRepo.gitUrl ?? (input.source === "remote" ? input.normalizedGitUrl : ""),
    localPath: input.source === "local" ? repoPath : "",
    worktreePath: input.backendRepo.worktreePath ?? (input.source === "local" ? repoPath : ""),
    privateContextEnabled: input.backendRepo.privateContextEnabled ?? true,
    defaultBranch: input.backendRepo.defaultBranch ?? "",
    icon: "folder",
    iconBgColor: "#1E66F5",
    setupScript: input.backendRepo.setupScript ?? "",
    postScript: input.backendRepo.postScript ?? "",
  } satisfies Repo;
  const localWorkspaceId = buildLocalWorkspaceId(nextRepoId);
  const hasLocalWorkspace = input.source === "local" && repoPath.trim().length > 0;
  const defaultBranch = input.backendRepo.defaultBranch ?? "main";
  const localWorkspaceLabel = getDefaultLocalWorkspaceLabel();

  return {
    projects: [...currentProjects, nextProject],
    repos: [
      ...state.repos,
      nextProject,
    ],
    workspaces: hasLocalWorkspace
      ? [
          ...state.workspaces,
          {
            id: localWorkspaceId,
            projectId: nextRepoId,
            repoId: nextRepoId,
            name: localWorkspaceLabel,
            title: localWorkspaceLabel,
            sourceBranch: defaultBranch,
            branch: defaultBranch,
            summaryId: localWorkspaceId,
            worktreePath: repoPath,
            kind: "local",
          },
        ]
      : state.workspaces,
    displayRepoIds:
      state.displayRepoIds.length === state.repos.length ? [...state.displayRepoIds, nextRepoId] : state.displayRepoIds,
    displayProjectIds:
      currentDisplayProjectIds.length === currentProjects.length
        ? [...currentDisplayProjectIds, nextRepoId]
        : currentDisplayProjectIds,
    selectedProjectId: nextRepoId,
    selectedRepoId: nextRepoId,
    selectedWorkspaceId: hasLocalWorkspace ? localWorkspaceId : "",
  };
}

/** Removes a repo and all workspace-scoped UI state derived from that repo. */
export function buildDeletedRepoState(state: RepoStoreSlice, repoId: string): Partial<RepoStoreSlice> {
  const currentDisplayProjectIds = state.displayProjectIds ?? state.displayRepoIds;
  const nextRepos = state.repos.filter((repo) => repo.id !== repoId);
  const deletedWorkspaceIdSet = new Set(
    state.workspaces
      .filter((workspace) => (workspace.projectId ?? workspace.repoId) === repoId)
      .map((workspace) => workspace.id),
  );
  const nextWorkspaces = state.workspaces.filter((workspace) => (workspace.projectId ?? workspace.repoId) !== repoId);
  const nextGitChangesCountByWorkspaceId = { ...state.gitChangesCountByWorkspaceId };
  const nextGitChangeTotalsByWorkspaceId = { ...state.gitChangeTotalsByWorkspaceId };
  for (const workspaceId of deletedWorkspaceIdSet) {
    delete nextGitChangesCountByWorkspaceId[workspaceId];
    delete nextGitChangeTotalsByWorkspaceId[workspaceId];
  }

  const nextSelectedRepoId = state.selectedRepoId === repoId ? (nextRepos[0]?.id ?? "") : state.selectedRepoId;
  const nextSelectedWorkspaceId = nextWorkspaces.some((workspace) => workspace.id === state.selectedWorkspaceId)
    ? state.selectedWorkspaceId
    : (nextWorkspaces.find((workspace) => (workspace.projectId ?? workspace.repoId) === nextSelectedRepoId)?.id ??
      nextWorkspaces[0]?.id ??
      "");

  return {
    projects: nextRepos,
    repos: nextRepos,
    workspaces: nextWorkspaces,
    displayProjectIds: currentDisplayProjectIds.filter((id) => id !== repoId),
    displayRepoIds: state.displayRepoIds.filter((id) => id !== repoId),
    selectedProjectId: nextSelectedRepoId,
    selectedRepoId: nextSelectedRepoId,
    selectedWorkspaceId: nextSelectedWorkspaceId,
    gitChangesCountByWorkspaceId: nextGitChangesCountByWorkspaceId,
    gitChangeTotalsByWorkspaceId: nextGitChangeTotalsByWorkspaceId,
  };
}

/** Applies repo config updates to local state after save attempts. */
export function buildUpdatedRepoConfigState(
  state: Pick<WorkspaceStoreState, "repos">,
  repoId: string,
  config: RepoConfigUpdate,
): Pick<WorkspaceStoreState, "repos"> {
  return {
    repos: state.repos.map((repo) =>
      repo.id === repoId
        ? {
            ...repo,
            name: config.name,
            worktreePath: config.worktreePath,
            privateContextEnabled: config.privateContextEnabled,
            icon: config.icon,
            iconBgColor: config.iconBgColor,
            setupScript: config.setupScript,
            postScript: config.postScript,
          }
        : repo,
    ),
  };
}
