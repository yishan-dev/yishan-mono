import { readPersistedDisplayRepoIds } from "../helpers/repoHelpers";
import { getApiServiceClient } from "../rpc/rpcTransport";
import { workspaceStore } from "../store/workspaceStore";
import type { RepoSnapshot } from "../types/repoTypes";
import { syncTabStoreWithWorkspace } from "./workspaceTabSync";

/**
 * Maps api-service repository and workspace rows into the legacy snapshot shape used by workspace store hydration.
 */
function mapBackendSnapshotToStore(
  repositoriesList: Array<{
    id: string;
    key: string;
    localPath: string | null;
    worktreePath: string | null;
    contextEnabled: boolean;
    icon: string | null;
    color: string | null;
    defaultBranch: string | null;
    setupScript: string | null;
    postScript: string | null;
    gitUrl: string | null;
  }>,
  workspacesList: Array<{
    id: string;
    repositoryId: string | null;
    instance: {
      workspaceId: string;
      repoId: string;
      name: string;
      sourceBranch: string;
      branch: string;
      worktreePath: string;
      status: string;
    } | null;
  }>,
): RepoSnapshot {
  const repoById = new Map<
    string,
    {
      id: string;
      key: string;
      localPath: string;
      gitUrl: string;
      worktreePath: string;
      privateContextEnabled: boolean;
      defaultBranch: string;
      icon: string;
      color: string;
      setupScript: string;
      postScript: string;
    }
  >();
  const workspaces: RepoSnapshot["workspaces"] = [];

  for (const repository of repositoriesList) {
    repoById.set(repository.id, {
      id: repository.id,
      key: repository.key,
      localPath: repository.localPath ?? "",
      gitUrl: repository.gitUrl ?? "",
      worktreePath: repository.worktreePath ?? repository.localPath ?? "",
      privateContextEnabled: repository.contextEnabled,
      defaultBranch: repository.defaultBranch ?? "main",
      icon: repository.icon ?? "folder",
      color: repository.color ?? "#1E66F5",
      setupScript: repository.setupScript ?? "",
      postScript: repository.postScript ?? "",
    });
  }

  for (const item of workspacesList) {
    const repositoryId = item.instance?.repoId ?? item.repositoryId ?? "";
    if (!repositoryId) {
      continue;
    }

    if (!repoById.has(repositoryId)) {
      repoById.set(repositoryId, {
        id: repositoryId,
        key: repositoryId,
        localPath: item.instance?.worktreePath ?? "",
        gitUrl: "",
        worktreePath: item.instance?.worktreePath ?? "",
        privateContextEnabled: true,
        defaultBranch: item.instance?.sourceBranch ?? "main",
        icon: "folder",
        color: "#1E66F5",
        setupScript: "",
        postScript: "",
      });
    }

    if (item.instance) {
      workspaces.push({
        workspaceId: item.instance.workspaceId,
        repoId: item.instance.repoId,
        name: item.instance.name,
        sourceBranch: item.instance.sourceBranch,
        branch: item.instance.branch,
        worktreePath: item.instance.worktreePath,
        status: item.instance.status,
      });
    }
  }

  return {
    repos: [...repoById.values()],
    workspaces,
  };
}

/** Loads backend snapshot data and hydrates the workspace store from it. */
export async function loadWorkspaceFromBackend(): Promise<void> {
  const previousWorkspaces = workspaceStore.getState().workspaces;

  try {
    const client = await getApiServiceClient();
    const [repositories, workspaces] = await Promise.all([
      client.repo.list.query(),
      client.workspace.list.query(undefined),
    ]);
    const snapshot = mapBackendSnapshotToStore(repositories, workspaces);
    const persistedDisplayRepoIds = readPersistedDisplayRepoIds(
      typeof localStorage === "undefined" ? undefined : localStorage,
    );
    workspaceStore.getState().loadWorkspaceFromBackend(snapshot, persistedDisplayRepoIds);
    syncTabStoreWithWorkspace(previousWorkspaces);
  } catch (error) {
    console.error("Failed to load workspace snapshot", error);
  }
}

/** Creates one repository in backend, then applies the created repo in local store state. */
export async function createRepo(input: {
  name: string;
  key?: string;
  source: "local" | "remote";
  path?: string;
  gitUrl?: string;
}): Promise<void> {
  const normalizedName = input.name.trim();
  const normalizedKey = input.key?.trim() || "";
  const normalizedPath = input.path?.trim() || "";
  const normalizedGitUrl = input.gitUrl?.trim() || "";
  const resolvedPath = input.source === "local" ? normalizedPath : normalizedGitUrl || normalizedPath;
  if (!normalizedName || !resolvedPath) {
    return;
  }

  const client = await getApiServiceClient();
  let backendRepo: Awaited<ReturnType<typeof client.repo.createRepo.mutate>> | undefined;

  try {
    backendRepo = await client.repo.createRepo.mutate({
      key: normalizedKey || undefined,
      localPath: input.source === "local" ? normalizedPath : undefined,
      remoteUrl: input.source === "remote" ? normalizedGitUrl : undefined,
      contextEnabled: true,
      icon: "folder",
      color: "#1E66F5",
    });
  } catch (error) {
    console.error("Failed to register backend repo", error);
  }

  if (!backendRepo?.id) {
    return;
  }

  workspaceStore.getState().createRepo({
    ...input,
    backendRepo,
  });
}

/** Deletes one repository in backend and then removes it from local store state. */
export async function deleteRepo(repoId: string): Promise<void> {
  if (!repoId) {
    return;
  }

  const previousWorkspaces = workspaceStore.getState().workspaces;
  const client = await getApiServiceClient();

  try {
    await client.repo.deleteRepo.mutate({ repoId });
  } catch (error) {
    console.error("Failed to delete backend repo and workspaces", error);
    return;
  }

  workspaceStore.getState().deleteRepo(repoId);
  syncTabStoreWithWorkspace(previousWorkspaces);
}

/** Persists repo config to backend and updates local config state when successful. */
export async function updateRepoConfig(
  repoId: string,
  config: {
    name: string;
    worktreePath: string;
    privateContextEnabled?: boolean;
    icon?: string;
    iconBgColor?: string;
    setupScript?: string;
    postScript?: string;
  },
): Promise<void> {
  const repo = workspaceStore.getState().repos.find((item) => item.id === repoId);
  if (!repo) {
    return;
  }

  const client = await getApiServiceClient();
  try {
    await client.repo.createRepo.mutate({
      key: repo.key,
      localPath: repo.localPath || undefined,
      remoteUrl: repo.gitUrl || undefined,
      worktreePath: config.worktreePath,
      contextEnabled: config.privateContextEnabled,
      icon: config.icon,
      color: config.iconBgColor,
      setupScript: config.setupScript,
      postScript: config.postScript,
    });
  } catch (error) {
    console.error("Failed to persist repo config", error);
    return;
  }

  const store = workspaceStore.getState();
  store.updateRepoConfig(repoId, config);
  store.incrementFileTreeRefreshVersion();
}
