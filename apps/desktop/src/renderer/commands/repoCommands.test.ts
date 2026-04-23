// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { chatStore } from "../store/chatStore";
import { tabStore } from "../store/tabStore";
import { workspaceStore } from "../store/workspaceStore";
import { createRepo, deleteRepo, loadWorkspaceFromBackend, updateRepoConfig } from "./repoCommands";

const rpcMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  listRepos: vi.fn(),
  createRepo: vi.fn(),
  deleteRepo: vi.fn(),
}));

vi.mock("../rpc/rpcTransport", () => ({
  getApiServiceClient: vi.fn(async () => ({
    repo: {
      list: {
        query: rpcMocks.listRepos,
      },
      createRepo: {
        mutate: rpcMocks.createRepo,
      },
      deleteRepo: {
        mutate: rpcMocks.deleteRepo,
      },
    },
    workspace: {
      list: {
        query: rpcMocks.listWorkspaces,
      },
    },
  })),
}));

const initialWorkspaceStoreState = workspaceStore.getState();
const initialTabStoreState = tabStore.getState();
const initialChatStoreState = chatStore.getState();

afterEach(() => {
  localStorage.clear();
  workspaceStore.setState(initialWorkspaceStoreState, true);
  tabStore.setState(initialTabStoreState, true);
  chatStore.setState(initialChatStoreState, true);
  vi.clearAllMocks();
});

describe("repoCommands", () => {
  it("loads backend snapshot and hydrates store", async () => {
    const hydrate = vi.fn();
    const retainWorkspaceTabs = vi.fn().mockReturnValue([]);
    const setSelectedWorkspaceId = vi.fn();
    tabStore.setState({ retainWorkspaceTabs, setSelectedWorkspaceId });
    workspaceStore.setState({ loadWorkspaceFromBackend: hydrate });
    rpcMocks.listRepos.mockResolvedValueOnce([
      {
        id: "repo-1",
        key: "repo-1",
        localPath: "/tmp/repo-1",
        worktreePath: "/tmp/repo-1",
        contextEnabled: true,
        icon: "folder",
        color: "#1E66F5",
        defaultBranch: "main",
        setupScript: null,
        postScript: null,
        gitUrl: null,
      },
    ]);
    rpcMocks.listWorkspaces.mockResolvedValueOnce([]);

    await loadWorkspaceFromBackend();

    expect(rpcMocks.listRepos).toHaveBeenCalledWith();
    expect(rpcMocks.listWorkspaces).toHaveBeenCalledWith(undefined);
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(hydrate.mock.calls[0]?.[0]).toEqual({
      repos: [
        {
          id: "repo-1",
          key: "repo-1",
          localPath: "/tmp/repo-1",
          gitUrl: "",
          worktreePath: "/tmp/repo-1",
          privateContextEnabled: true,
          defaultBranch: "main",
          icon: "folder",
          color: "#1E66F5",
          setupScript: "",
          postScript: "",
        },
      ],
      workspaces: [],
    });
    expect(retainWorkspaceTabs).toHaveBeenCalledTimes(1);
    expect(setSelectedWorkspaceId).toHaveBeenCalledTimes(1);
  });

  it("creates backend repo and then appends store state", async () => {
    const appendRepo = vi.fn();
    workspaceStore.setState({ createRepo: appendRepo });
    rpcMocks.createRepo.mockResolvedValueOnce({
      id: "repo-1",
      key: "repo-1",
      localPath: "/tmp/repo-1",
      worktreePath: "/tmp/repo-1",
      gitUrl: "",
      contextEnabled: true,
      icon: null,
      color: null,
      setupScript: "",
      postScript: "",
      defaultBranch: null,
    });

    await createRepo({
      name: "Repo 1",
      key: "repo-1",
      source: "local",
      path: "/tmp/repo-1",
    });

    expect(rpcMocks.createRepo).toHaveBeenCalledWith({
      key: "repo-1",
      localPath: "/tmp/repo-1",
      remoteUrl: undefined,
      contextEnabled: true,
      icon: "folder",
      color: "#1E66F5",
    });
    expect(appendRepo).toHaveBeenCalledTimes(1);
  });

  it("deletes backend repo and then removes repo from store", async () => {
    const removeRepo = vi.fn();
    const retainWorkspaceTabs = vi.fn().mockReturnValue(["tab-1"]);
    const setSelectedWorkspaceId = vi.fn();
    const removeTabData = vi.fn();
    const removeWorkspaceTaskCounts = vi.fn();

    tabStore.setState({ retainWorkspaceTabs, setSelectedWorkspaceId });
    chatStore.setState({ removeTabData, removeWorkspaceTaskCounts });
    workspaceStore.setState({ deleteRepo: removeRepo });
    rpcMocks.deleteRepo.mockResolvedValueOnce({
      repoId: "repo-1",
      deletedWorkspaceIds: ["workspace-1"],
      repoDeleted: true,
    });

    await deleteRepo("repo-1");

    expect(rpcMocks.deleteRepo).toHaveBeenCalledWith({ repoId: "repo-1" });
    expect(removeRepo).toHaveBeenCalledWith("repo-1");
    expect(retainWorkspaceTabs).toHaveBeenCalledTimes(1);
    expect(setSelectedWorkspaceId).toHaveBeenCalledTimes(1);
    expect(removeTabData).toHaveBeenCalledWith(["tab-1"]);
    expect(removeWorkspaceTaskCounts).not.toHaveBeenCalled();
  });

  it("persists config and updates local store fields", async () => {
    const applyRepoConfig = vi.fn();
    const bumpRefreshVersion = vi.fn();
    workspaceStore.setState({
      repos: [
        {
          id: "repo-1",
          key: "repo-1",
          name: "Repo 1",
          path: "/tmp/repo-1",
          missing: false,
          localPath: "/tmp/repo-1",
          gitUrl: "",
          worktreePath: "/tmp/repo-1",
        },
      ],
      updateRepoConfig: applyRepoConfig,
      incrementFileTreeRefreshVersion: bumpRefreshVersion,
    });
    rpcMocks.createRepo.mockResolvedValueOnce({
      id: "repo-1",
      key: "repo-1",
      localPath: "/tmp/repo-1",
      worktreePath: "/tmp/repo-1",
      gitUrl: "",
      contextEnabled: true,
      icon: null,
      color: null,
      setupScript: "",
      postScript: "",
      defaultBranch: null,
    });

    await updateRepoConfig("repo-1", {
      name: "Repo 1",
      worktreePath: "/tmp/repo-1",
      privateContextEnabled: true,
      icon: "folder",
      iconBgColor: "#1E66F5",
      setupScript: "npm ci",
      postScript: "rm -rf node_modules",
    });

    expect(rpcMocks.createRepo).toHaveBeenCalledTimes(1);
    expect(rpcMocks.createRepo.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        key: "repo-1",
        worktreePath: "/tmp/repo-1",
      }),
    );
    expect(applyRepoConfig).toHaveBeenCalledTimes(1);
    expect(bumpRefreshVersion).toHaveBeenCalledTimes(1);
  });
});
