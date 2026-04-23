export type RepoRecord = {
  id: string;
  key?: string | null;
  name?: string | null;
  localPath?: string | null;
  worktreePath?: string | null;
  gitUrl?: string | null;
  repoUrl?: string | null;
  contextEnabled?: boolean;
  privateContextEnabled?: boolean;
  defaultBranch?: string | null;
  icon?: string | null;
  color?: string | null;
  setupScript?: string | null;
  postScript?: string | null;
};

export type RepoWorkspaceRecord = {
  workspaceId: string;
  repoId?: string;
  projectId?: string;
  name?: string;
  sourceBranch?: string;
  branch?: string;
  worktreePath?: string;
  localPath?: string;
  status?: string;
};

export type RepoSnapshot = {
  repos: RepoRecord[];
  workspaces: RepoWorkspaceRecord[];
};

export type CreateRepoResult = {
  id: string;
  key?: string | null;
  localPath?: string | null;
  worktreePath?: string | null;
  gitUrl?: string | null;
  privateContextEnabled?: boolean;
  contextEnabled?: boolean;
  icon?: string | null;
  color?: string | null;
  setupScript?: string | null;
  postScript?: string | null;
  defaultBranch?: string | null;
};
