import { buildWorkspaceStateFromData } from "../store/state";
import { getFileName } from "../store/tabs";
import type { Repo, RepoWorkspaceItem, WorkspaceStoreState } from "../store/types";
import type { CreateRepoResult, RepoSnapshot } from "../types/repoTypes";

type RepoStoreSlice = Pick<
  WorkspaceStoreState,
  | "repos"
  | "workspaces"
  | "gitChangesCountByWorkspaceId"
  | "gitChangeTotalsByWorkspaceId"
  | "selectedRepoId"
  | "selectedWorkspaceId"
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
        displayRepoIds?: unknown;
      };
    };
    const candidate = parsed.state?.displayRepoIds;
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
    return {
      id: repo.id,
      key: repo.key ?? repo.id,
      name: path ? getFileName(path) : repo.id,
      path,
      missing: !path,
      gitUrl: repo.gitUrl ?? "",
      localPath: path,
      worktreePath: repo.worktreePath ?? path,
      privateContextEnabled: repo.privateContextEnabled ?? true,
      defaultBranch: repo.defaultBranch ?? "",
      icon: repo.icon ?? "folder",
      iconBgColor: repo.color ?? "#1E66F5",
      setupScript: repo.setupScript ?? "",
      postScript: repo.postScript ?? "",
    } satisfies Repo;
  });

  const repoIdSet = new Set(repos.map((repo) => repo.id));
  const managedWorkspaces = snapshot.workspaces
    .filter((workspace) => repoIdSet.has(workspace.repoId) && workspace.status !== "closed")
    .map(
      (workspace) =>
        ({
          id: workspace.workspaceId,
          repoId: workspace.repoId,
          name: workspace.name,
          title: workspace.name || getFileName(workspace.worktreePath) || workspace.branch,
          sourceBranch: workspace.sourceBranch,
          branch: workspace.branch,
          summaryId: workspace.workspaceId,
          worktreePath: workspace.worktreePath,
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
  const baseDisplayRepoIds = persistedDisplayRepoIds ?? state.displayRepoIds;
  const nextDisplayRepoIds =
    persistedDisplayRepoIds === undefined && baseDisplayRepoIds.length === 0
      ? repos.map((repo) => repo.id)
      : baseDisplayRepoIds.filter((repoId) => nextRepoIdSet.has(repoId));
  const nextWorkspaceIdSet = new Set(workspaces.map((workspace) => workspace.id));

  return {
    ...nextBaseState,
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
  const nextRepoId = input.backendRepo.id;
  const repoPath = input.backendRepo.localPath ?? input.resolvedPath;
  const localWorkspaceId = buildLocalWorkspaceId(nextRepoId);
  const hasLocalWorkspace = input.source === "local" && repoPath.trim().length > 0;
  const defaultBranch = input.backendRepo.defaultBranch ?? "main";
  const localWorkspaceLabel = getDefaultLocalWorkspaceLabel();

  return {
    repos: [
      ...state.repos,
      {
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
      },
    ],
    workspaces: hasLocalWorkspace
      ? [
          ...state.workspaces,
          {
            id: localWorkspaceId,
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
    selectedRepoId: nextRepoId,
    selectedWorkspaceId: hasLocalWorkspace ? localWorkspaceId : "",
  };
}

/** Removes a repo and all workspace-scoped UI state derived from that repo. */
export function buildDeletedRepoState(state: RepoStoreSlice, repoId: string): Partial<RepoStoreSlice> {
  const nextRepos = state.repos.filter((repo) => repo.id !== repoId);
  const deletedWorkspaceIdSet = new Set(
    state.workspaces.filter((workspace) => workspace.repoId === repoId).map((workspace) => workspace.id),
  );
  const nextWorkspaces = state.workspaces.filter((workspace) => workspace.repoId !== repoId);
  const nextGitChangesCountByWorkspaceId = { ...state.gitChangesCountByWorkspaceId };
  const nextGitChangeTotalsByWorkspaceId = { ...state.gitChangeTotalsByWorkspaceId };
  for (const workspaceId of deletedWorkspaceIdSet) {
    delete nextGitChangesCountByWorkspaceId[workspaceId];
    delete nextGitChangeTotalsByWorkspaceId[workspaceId];
  }

  const nextSelectedRepoId = state.selectedRepoId === repoId ? (nextRepos[0]?.id ?? "") : state.selectedRepoId;
  const nextSelectedWorkspaceId = nextWorkspaces.some((workspace) => workspace.id === state.selectedWorkspaceId)
    ? state.selectedWorkspaceId
    : (nextWorkspaces.find((workspace) => workspace.repoId === nextSelectedRepoId)?.id ?? nextWorkspaces[0]?.id ?? "");

  return {
    repos: nextRepos,
    workspaces: nextWorkspaces,
    displayRepoIds: state.displayRepoIds.filter((id) => id !== repoId),
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
