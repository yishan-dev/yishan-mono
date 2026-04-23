import type { StateCreator } from "zustand";
import type { ExternalAppId } from "../../shared/contracts/externalApps";
import type { CreateRepoResult, RepoSnapshot } from "../types/repoTypes";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
};

export type AvailableCommand = {
  name: string;
  description: string;
};

export type AvailableModel = {
  id: string;
  name: string;
};

export type Repo = {
  id: string;
  key: string;
  name: string;
  path: string;
  missing: boolean;
  gitUrl?: string;
  localPath?: string;
  worktreePath: string;
  privateContextEnabled?: boolean;
  defaultBranch?: string;
  icon?: string;
  iconBgColor?: string;
  setupScript?: string;
  postScript?: string;
};

export type RepoWorkspaceItem = {
  id: string;
  repoId: string;
  name: string;
  title: string;
  sourceBranch: string;
  branch: string;
  summaryId: string;
  worktreePath?: string;
  kind?: "managed" | "local";
};

export type DiffFileChangeKind = "added" | "modified" | "deleted";

export type WorkspaceGitChangeTotals = {
  additions: number;
  deletions: number;
};

export type WorkspaceTabDataByKind = {
  session: {
    sessionId?: string;
    agentKind?: "opencode" | "codex" | "claude";
    isInitializing?: boolean;
  };
  diff: { path: string; oldContent: string; newContent: string };
  file: { path: string; content: string; savedContent: string; isDirty: boolean; isTemporary: boolean };
  terminal: {
    title: string;
    /** Stable terminal pane identity used by observer correlation. */
    paneId?: string;
    /** Backend terminal runtime session id bound to this tab. */
    sessionId?: string;
    launchCommand?: string;
    agentKind?: "opencode" | "codex" | "claude";
  };
};

export type WorkspaceTabBase = {
  id: string;
  workspaceId: string;
  title: string;
  pinned: boolean;
};

export type WorkspaceTab =
  | (WorkspaceTabBase & {
      kind: "session";
      data: WorkspaceTabDataByKind["session"];
    })
  | (WorkspaceTabBase & {
      kind: "diff";
      data: WorkspaceTabDataByKind["diff"];
    })
  | (WorkspaceTabBase & {
      kind: "file";
      data: WorkspaceTabDataByKind["file"];
    })
  | (WorkspaceTabBase & {
      kind: "terminal";
      data: WorkspaceTabDataByKind["terminal"];
    });

export type OpenWorkspaceTabInput =
  | {
      workspaceId?: string;
      kind: "diff";
      path: string;
      changeKind: DiffFileChangeKind;
      additions: number;
      deletions: number;
      oldContent?: string;
      newContent?: string;
    }
  | {
      workspaceId?: string;
      kind: "file";
      path: string;
      content?: string;
      temporary?: boolean;
    }
  | {
      workspaceId?: string;
      kind: "terminal";
      title?: string;
      launchCommand?: string;
      agentKind?: "opencode" | "codex" | "claude";
      reuseExisting?: boolean;
    };

export type WorkspaceStoreState = {
  repos: Repo[];
  workspaces: RepoWorkspaceItem[];
  gitChangesCountByWorkspaceId: Record<string, number>;
  gitChangeTotalsByWorkspaceId: Record<string, WorkspaceGitChangeTotals>;
  gitRefreshVersionByWorktreePath: Record<string, number>;
  fileTreeChangedRelativePathsByWorktreePath: Record<string, string[]>;
  selectedRepoId: string;
  selectedWorkspaceId: string;
  displayRepoIds: string[];
  lastUsedExternalAppId?: ExternalAppId;
  fileTreeRefreshVersion: number;
  setSelectedRepoId: (repoId: string) => void;
  setSelectedWorkspaceId: (workspaceId: string) => void;
  setDisplayRepoIds: (repoIds: string[]) => void;
  setLastUsedExternalAppId: (appId: ExternalAppId) => void;
  loadWorkspaceFromBackend: (snapshot: RepoSnapshot, persistedDisplayRepoIds?: string[]) => void;
  createRepo: (input: {
    name: string;
    source: "local" | "remote";
    path?: string;
    gitUrl?: string;
    backendRepo: CreateRepoResult;
  }) => void;
  deleteRepo: (repoId: string) => void;
  updateRepoConfig: (
    repoId: string,
    config: Pick<
      Repo,
      "name" | "worktreePath" | "privateContextEnabled" | "icon" | "iconBgColor" | "setupScript" | "postScript"
    >,
  ) => void;
  incrementFileTreeRefreshVersion: (workspaceWorktreePath?: string, changedRelativePaths?: string[]) => void;
  addWorkspace: (input: {
    repoId: string;
    name: string;
    sourceBranch: string;
    branch: string;
    worktreePath?: string;
    workspaceId: string;
  }) => void;
  deleteWorkspace: (input: {
    repoId: string;
    workspaceId: string;
  }) => void;
  renameWorkspace: (input: {
    repoId: string;
    workspaceId: string;
    name: string;
  }) => void;
  renameWorkspaceBranch: (input: {
    repoId: string;
    workspaceId: string;
    branch: string;
  }) => void;
  setWorkspaceGitChangesCount: (workspaceId: string, count: number) => void;
  setWorkspaceGitChangeTotals: (workspaceId: string, totals: WorkspaceGitChangeTotals) => void;
  incrementGitRefreshVersion: (workspaceWorktreePath: string) => void;
};

export type WorkspaceStorePersistedState = Pick<WorkspaceStoreState, "displayRepoIds" | "lastUsedExternalAppId">;

export type WorkspaceStoreActions = Pick<
  WorkspaceStoreState,
  | "setSelectedRepoId"
  | "setSelectedWorkspaceId"
  | "setDisplayRepoIds"
  | "setLastUsedExternalAppId"
  | "loadWorkspaceFromBackend"
  | "createRepo"
  | "deleteRepo"
  | "updateRepoConfig"
  | "incrementFileTreeRefreshVersion"
  | "addWorkspace"
  | "deleteWorkspace"
  | "renameWorkspace"
  | "renameWorkspaceBranch"
  | "setWorkspaceGitChangesCount"
  | "setWorkspaceGitChangeTotals"
  | "incrementGitRefreshVersion"
>;

export type WorkspaceStoreCreator = StateCreator<WorkspaceStoreState, [], [], WorkspaceStoreState>;

export type WorkspaceStoreSetState = Parameters<WorkspaceStoreCreator>[0];
export type WorkspaceStoreGetState = Parameters<WorkspaceStoreCreator>[1];
