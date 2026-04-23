import { describe, expect, it } from "vitest";
import { createWorkspaceRepoActions } from "./actions.projects";

type TestState = {
  repos: Array<{
    id: string;
    name: string;
    path: string;
    missing: boolean;
    localPath?: string;
    gitUrl?: string;
    worktreePath: string;
    privateContextEnabled?: boolean;
    icon?: string;
    iconBgColor?: string;
    setupScript?: string;
    postScript?: string;
  }>;
  workspaces: Array<{
    id: string;
    repoId: string;
    name: string;
    title: string;
    sourceBranch: string;
    branch: string;
    summaryId: string;
    worktreePath?: string;
  }>;
  selectedRepoId: string;
  selectedWorkspaceId: string;
  displayRepoIds: string[];
  fileTreeRefreshVersion: number;
  fileTreeChangedRelativePathsByWorktreePath: Record<string, string[]>;
  gitChangesCountByWorkspaceId: Record<string, number>;
  gitChangeTotalsByWorkspaceId: Record<string, { additions: number; deletions: number }>;
};

/** Creates a minimal state harness for pure repo store actions. */
function createHarness(overrides?: Partial<TestState>) {
  let state: TestState = {
    repos: [
      {
        id: "repo-1",
        name: "Repo 1",
        path: "/tmp/repo-1",
        missing: false,
        localPath: "/tmp/repo-1",
        gitUrl: "",
        worktreePath: "/tmp/repo-1",
        privateContextEnabled: true,
        icon: "folder",
        iconBgColor: "#1E66F5",
        setupScript: "",
        postScript: "",
      },
      {
        id: "repo-2",
        name: "Repo 2",
        path: "/tmp/repo-2",
        missing: false,
        localPath: "/tmp/repo-2",
        gitUrl: "",
        worktreePath: "/tmp/repo-2",
        privateContextEnabled: true,
        icon: "folder",
        iconBgColor: "#1E66F5",
        setupScript: "",
        postScript: "",
      },
    ],
    workspaces: [
      {
        id: "workspace-1",
        repoId: "repo-1",
        name: "Feature A",
        title: "Feature A",
        sourceBranch: "main",
        branch: "feature-a",
        summaryId: "workspace-1",
        worktreePath: "/tmp/repo-1/.worktrees/feature-a",
      },
      {
        id: "workspace-2",
        repoId: "repo-2",
        name: "Feature B",
        title: "Feature B",
        sourceBranch: "main",
        branch: "feature-b",
        summaryId: "workspace-2",
        worktreePath: "/tmp/repo-2/.worktrees/feature-b",
      },
    ],
    selectedRepoId: "repo-1",
    selectedWorkspaceId: "workspace-1",
    displayRepoIds: ["repo-1", "repo-2"],
    fileTreeRefreshVersion: 0,
    fileTreeChangedRelativePathsByWorktreePath: {},
    gitChangesCountByWorkspaceId: {
      "workspace-1": 3,
      "workspace-2": 4,
    },
    gitChangeTotalsByWorkspaceId: {
      "workspace-1": { additions: 5, deletions: 2 },
      "workspace-2": { additions: 9, deletions: 4 },
    },
    ...overrides,
  };

  const set = ((updater: Partial<TestState> | ((current: TestState) => Partial<TestState> | TestState)) => {
    const partial = typeof updater === "function" ? updater(state) : updater;
    state = {
      ...state,
      ...partial,
    };
  }) as Parameters<typeof createWorkspaceRepoActions>[0];

  const get = (() => state) as unknown as Parameters<typeof createWorkspaceRepoActions>[1];
  const actions = createWorkspaceRepoActions(set, get);

  return {
    actions,
    getState: () => state,
  };
}

describe("createWorkspaceRepoActions", () => {
  it("deletes one repo and all child workspace state", () => {
    const harness = createHarness();
    harness.actions.deleteRepo("repo-1");

    const state = harness.getState();
    expect(state.repos.map((repo) => repo.id)).toEqual(["repo-2"]);
    expect(state.workspaces.map((workspace) => workspace.id)).toEqual(["workspace-2"]);
    expect(state.selectedRepoId).toBe("repo-2");
    expect(state.selectedWorkspaceId).toBe("workspace-2");
    expect(state.gitChangesCountByWorkspaceId).toEqual({
      "workspace-2": 4,
    });
    expect(state.gitChangeTotalsByWorkspaceId).toEqual({
      "workspace-2": { additions: 9, deletions: 4 },
    });
  });

  it("hydrates state from backend snapshot", () => {
    const harness = createHarness();

    harness.actions.loadWorkspaceFromBackend(
      {
        repos: [
          {
            id: "repo-1",
            key: "repo-1",
            localPath: "/tmp/repo-1",
            worktreePath: "/tmp/repo-1",
            privateContextEnabled: true,
            icon: "folder",
            color: "#1E66F5",
            setupScript: "",
            postScript: "",
            defaultBranch: "main",
            gitUrl: "https://example.com/acme/repo.git",
          },
        ],
        workspaces: [
          {
            workspaceId: "workspace-1",
            repoId: "repo-1",
            name: "Feature A",
            sourceBranch: "main",
            branch: "feature-a",
            worktreePath: "/tmp/repo-1/.worktrees/feature-a",
            status: "open",
          },
        ],
      },
      ["repo-1"],
    );

    const state = harness.getState();
    expect(state.repos).toHaveLength(1);
    expect(state.repos[0]?.gitUrl).toBe("https://example.com/acme/repo.git");
    expect(state.displayRepoIds).toEqual(["repo-1"]);
    expect(state.gitChangesCountByWorkspaceId).toEqual({
      "workspace-1": 3,
    });
    expect(state.gitChangeTotalsByWorkspaceId).toEqual({
      "workspace-1": { additions: 5, deletions: 2 },
    });
  });

  it("adds repo state from backend create result", () => {
    const harness = createHarness({ repos: [], workspaces: [], displayRepoIds: [] });

    harness.actions.createRepo({
      name: "Repo 1",
      source: "local",
      path: "/tmp/repo-1",
      backendRepo: {
        id: "repo-1",
        key: "repo-1",
        localPath: "/tmp/repo-1",
        worktreePath: "/tmp/repo-1",
        gitUrl: "",
        privateContextEnabled: true,
        icon: "folder",
        color: "#1E66F5",
        setupScript: "",
        postScript: "",
        defaultBranch: null,
      },
    });

    const state = harness.getState();
    expect(state.repos.map((repo) => repo.id)).toEqual(["repo-1"]);
    expect(state.workspaces).toEqual([
      expect.objectContaining({
        id: "local-repo-1",
        repoId: "repo-1",
        name: "local",
        worktreePath: "/tmp/repo-1",
        kind: "local",
      }),
    ]);
    expect(state.selectedRepoId).toBe("repo-1");
    expect(state.selectedWorkspaceId).toBe("local-repo-1");
  });

  it("updates repo config and refresh version as separate pure actions", () => {
    const harness = createHarness();
    harness.actions.updateRepoConfig("repo-1", {
      name: "Repo Updated",
      worktreePath: "/tmp/repo-1",
      privateContextEnabled: true,
      icon: "folder",
      iconBgColor: "#1E66F5",
      setupScript: "npm ci",
      postScript: "rm -rf node_modules",
    });
    harness.actions.incrementFileTreeRefreshVersion();

    const state = harness.getState();
    expect(state.repos[0]?.name).toBe("Repo Updated");
    expect(state.repos[0]?.setupScript).toBe("npm ci");
    expect(state.repos[0]?.postScript).toBe("rm -rf node_modules");
    expect(state.fileTreeRefreshVersion).toBe(1);
  });
});
