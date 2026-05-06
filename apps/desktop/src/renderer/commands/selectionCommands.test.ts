// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { tabStore } from "../store/tabStore";
import { workspaceStore } from "../store/workspaceStore";
import { setSelectedRepo, setSelectedWorkspace } from "./selectionCommands";

const initialWorkspaceStoreState = workspaceStore.getState();
const initialTabStoreState = tabStore.getState();

afterEach(() => {
  workspaceStore.setState(initialWorkspaceStoreState, true);
  tabStore.setState(initialTabStoreState, true);
  vi.clearAllMocks();
});

describe("selectionCommands", () => {
  it("selects repo and syncs selected workspace into tab store", () => {
    const setSelectedProjectId = vi.fn();
    const setSelectedWorkspaceId = vi.fn();
    workspaceStore.setState({
      setSelectedProjectId,
      selectedWorkspaceId: "workspace-2",
    });
    tabStore.setState({ setSelectedWorkspaceId });

    setSelectedRepo("repo-2");

    expect(setSelectedProjectId).toHaveBeenCalledWith("repo-2");
    expect(setSelectedWorkspaceId).toHaveBeenCalledWith("workspace-2");
  });

  it("selects workspace in both workspace and tab stores", () => {
    const setSelectedWorkspaceIdInWorkspaceStore = vi.fn();
    const setSelectedWorkspaceIdInTabStore = vi.fn();
    workspaceStore.setState({
      setSelectedWorkspaceId: setSelectedWorkspaceIdInWorkspaceStore,
    });
    tabStore.setState({
      setSelectedWorkspaceId: setSelectedWorkspaceIdInTabStore,
    });

    setSelectedWorkspace("workspace-3");

    expect(setSelectedWorkspaceIdInWorkspaceStore).toHaveBeenCalledWith("workspace-3");
    expect(setSelectedWorkspaceIdInTabStore).toHaveBeenCalledWith("workspace-3");
  });
});
