import { removeTabMetadataById } from "./shared";
import type { WorkspaceTabStateSlice } from "./types";

/** Closes one tab and updates selected-tab pointers and per-tab metadata maps. */
export function closeTabState(state: WorkspaceTabStateSlice, tabId: string): Partial<WorkspaceTabStateSlice> | null {
  const currentTab = state.tabs.find((tab) => tab.id === tabId);
  if (!currentTab) {
    return null;
  }

  const workspaceTabs = state.tabs.filter((tab) => tab.workspaceId === currentTab.workspaceId);
  const remainingWorkspaceTabs = workspaceTabs.filter((tab) => tab.id !== tabId);
  const closedIndex = workspaceTabs.findIndex((tab) => tab.id === tabId);
  const fallbackIndex = Math.max(0, closedIndex - 1);
  const nextSelectedTabId =
    state.selectedTabId === tabId
      ? (remainingWorkspaceTabs[fallbackIndex]?.id ?? remainingWorkspaceTabs[0]?.id ?? "")
      : state.selectedTabId;

  return {
    tabs: state.tabs.filter((tab) => tab.id !== tabId),
    ...removeTabMetadataById(state, [tabId]),
    selectedTabId: nextSelectedTabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [currentTab.workspaceId]: nextSelectedTabId,
    },
  };
}

/** Closes all sibling tabs in the same workspace and keeps one tab focused. */
export function closeOtherTabsState(
  state: WorkspaceTabStateSlice,
  tabId: string,
): Partial<WorkspaceTabStateSlice> | null {
  const currentTab = state.tabs.find((tab) => tab.id === tabId);
  if (!currentTab) {
    return null;
  }

  const tabs = state.tabs.filter((tab) => tab.workspaceId !== currentTab.workspaceId || tab.id === tabId);
  const removedTabIds = state.tabs
    .filter((tab) => tab.workspaceId === currentTab.workspaceId && tab.id !== tabId)
    .map((tab) => tab.id);

  return {
    tabs,
    ...removeTabMetadataById(state, removedTabIds),
    selectedTabId: tabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [currentTab.workspaceId]: tabId,
    },
  };
}

/** Closes all tabs for a workspace and clears workspace tab selection cache. */
export function closeAllTabsState(
  state: WorkspaceTabStateSlice,
  tabId: string,
): Partial<WorkspaceTabStateSlice> | null {
  const currentTab = state.tabs.find((tab) => tab.id === tabId);
  if (!currentTab) {
    return null;
  }

  const tabs = state.tabs.filter((tab) => tab.workspaceId !== currentTab.workspaceId);
  const removedTabIds = state.tabs.filter((tab) => tab.workspaceId === currentTab.workspaceId).map((tab) => tab.id);
  const selectedTabBelongsToWorkspace = state.tabs.some(
    (tab) => tab.id === state.selectedTabId && tab.workspaceId === currentTab.workspaceId,
  );

  return {
    tabs,
    ...removeTabMetadataById(state, removedTabIds),
    selectedTabId: selectedTabBelongsToWorkspace ? "" : state.selectedTabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [currentTab.workspaceId]: "",
    },
  };
}
