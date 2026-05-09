import type { StateCreator } from "zustand";
import type { ExternalAppId } from "../../shared/contracts/externalApps";
import type { ProjectRecord, WorkspaceRecord } from "../api/types";
import type { DesktopAgentKind } from "../helpers/agentSettings";

export type WorkspaceProjectRecord = {
  id: string;
  name: string;
  key?: string;
  path?: string;
  missing?: boolean;
  gitUrl?: string;
  sourceType?: "git" | "git-local" | "unknown";
  repoProvider?: string | null;
  repoUrl?: string | null;
  repoKey?: string | null;
  localPath?: string | null;
  worktreePath?: string | null;
  contextEnabled?: boolean;
  defaultBranch?: string | null;
  icon?: string | null;
  color?: string | null;
  setupScript?: string | null;
  postScript?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdByUserId?: string;
};

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

export type RepoWorkspaceItem = {
  id: string;
  organizationId?: string;
  projectId?: string;
  repoId: string;
  name: string;
  title: string;
  sourceBranch: string;
  branch: string;
  summaryId: string;
  worktreePath?: string;
  kind?: "managed" | "local";
};

export type DiffFileChangeKind = "added" | "modified" | "deleted" | "renamed";

export type DiffTabSource =
  | { kind: "workspace" }
  | { kind: "commit"; commitHash: string }
  | { kind: "branch"; targetBranch: string };

export type WorkspaceGitChangeTotals = {
  additions: number;
  deletions: number;
};

export type WorkspaceTabDataByKind = {
  session: {
    sessionId?: string;
    agentKind?: DesktopAgentKind;
    isInitializing?: boolean;
  };
  diff: { path: string; oldContent: string; newContent: string; source?: DiffTabSource };
  file: {
    path: string;
    content: string;
    savedContent: string;
    isDirty: boolean;
    isTemporary: boolean;
    isDeleted?: boolean;
  };
  image: { path: string; dataUrl: string; isTemporary: boolean };
  terminal: {
    title: string;
    /** Stable terminal pane identity used by observer correlation. */
    paneId?: string;
    /** Backend terminal runtime session id bound to this tab. */
    sessionId?: string;
    launchCommand?: string;
    agentKind?: DesktopAgentKind;
    /** When true, auto-rename from terminal commands/paths is suppressed. */
    userRenamed?: boolean;
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
      kind: "image";
      data: WorkspaceTabDataByKind["image"];
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
      diffSource?: DiffTabSource;
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
      kind: "image";
      path: string;
      dataUrl: string;
      temporary?: boolean;
    }
  | {
      workspaceId?: string;
      kind: "terminal";
      title?: string;
      launchCommand?: string;
      agentKind?: DesktopAgentKind;
      reuseExisting?: boolean;
    };

export type WorkspaceStoreState = {
  projects: WorkspaceProjectRecord[];
  workspaces: RepoWorkspaceItem[];
  gitChangesCountByWorkspaceId: Record<string, number>;
  gitChangeTotalsByWorkspaceId: Record<string, WorkspaceGitChangeTotals>;
  gitRefreshVersionByWorktreePath: Record<string, number>;
  fileTreeChangedRelativePathsByWorktreePath: Record<string, string[]>;
  selectedProjectId: string;
  selectedWorkspaceId: string;
  displayProjectIds: string[];
  lastUsedExternalAppId?: ExternalAppId;
  organizationPreferencesById?: Record<string, WorkspaceStoreOrganizationPreference>;
  fileTreeRefreshVersion: number;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedWorkspaceId: (workspaceId: string) => void;
  setDisplayProjectIds: (projectIds: string[]) => void;
  setLastUsedExternalAppId: (appId: ExternalAppId) => void;
  load: (
    organizationId: string,
    projects: ProjectRecord[],
    workspaces: WorkspaceRecord[],
  ) => void;
  createProject: (input: {
    name: string;
    source: "local" | "remote";
    path?: string;
    gitUrl?: string;
    backendProject: WorkspaceProjectRecord;
  }) => void;
  deleteProject: (projectId: string) => void;
  updateProjectConfig: (
    projectId: string,
    config: Pick<
      WorkspaceProjectRecord,
      | "name"
      | "worktreePath"
      | "contextEnabled"
      | "icon"
      | "color"
      | "setupScript"
      | "postScript"
    >,
  ) => void;
  incrementFileTreeRefreshVersion: (workspaceWorktreePath?: string, changedRelativePaths?: string[]) => void;
  addWorkspace: (input: {
    organizationId?: string;
    projectId?: string;
    repoId?: string;
    name: string;
    sourceBranch: string;
    branch: string;
    worktreePath?: string;
    workspaceId: string;
  }) => void;
  closeWorkspace: (input: {
    projectId?: string;
    repoId?: string;
    workspaceId: string;
  }) => void;
  renameWorkspace: (input: {
    projectId?: string;
    repoId?: string;
    workspaceId: string;
    name: string;
  }) => void;
  renameWorkspaceBranch: (input: {
    projectId?: string;
    repoId?: string;
    workspaceId: string;
    branch: string;
  }) => void;
  setWorkspaceGitChangesCount: (workspaceId: string, count: number) => void;
  setWorkspaceGitChangeTotals: (workspaceId: string, totals: WorkspaceGitChangeTotals) => void;
  incrementGitRefreshVersion: (workspaceWorktreePath: string) => void;
};

export type WorkspaceStoreOrganizationPreference = {
  selectedProjectId?: string;
  selectedWorkspaceId?: string;
  displayProjectIds?: string[];
  lastUsedExternalAppId?: ExternalAppId;
};

export type WorkspaceStorePersistedState = Pick<
  WorkspaceStoreState,
  "displayProjectIds" | "lastUsedExternalAppId" | "organizationPreferencesById"
>;

export type WorkspaceStoreActions = Pick<
  WorkspaceStoreState,
  | "setSelectedProjectId"
  | "setSelectedWorkspaceId"
  | "setDisplayProjectIds"
  | "setLastUsedExternalAppId"
  | "load"
  | "createProject"
  | "deleteProject"
  | "updateProjectConfig"
  | "incrementFileTreeRefreshVersion"
  | "addWorkspace"
  | "closeWorkspace"
  | "renameWorkspace"
  | "renameWorkspaceBranch"
  | "setWorkspaceGitChangesCount"
  | "setWorkspaceGitChangeTotals"
  | "incrementGitRefreshVersion"
>;

export type WorkspaceStoreCreator = StateCreator<
  WorkspaceStoreState,
  [["zustand/immer", never]],
  [],
  WorkspaceStoreState
>;

export type WorkspaceStoreSetState = Parameters<WorkspaceStoreCreator>[0];
export type WorkspaceStoreGetState = Parameters<WorkspaceStoreCreator>[1];
