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
  const nextSelectedTabId =
    state.selectedTabId === tabId
      ? (remainingWorkspaceTabs[closedIndex]?.id ?? remainingWorkspaceTabs[closedIndex - 1]?.id ?? "")
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

/** Closes all unpinned sibling tabs in the same workspace and keeps one tab focused. */
export function closeOtherTabsState(
  state: WorkspaceTabStateSlice,
  tabId: string,
): Partial<WorkspaceTabStateSlice> | null {
  const currentTab = state.tabs.find((tab) => tab.id === tabId);
  if (!currentTab) {
    return null;
  }

  const tabs = state.tabs.filter(
    (tab) => tab.workspaceId !== currentTab.workspaceId || tab.id === tabId || tab.pinned,
  );
  const removedTabIds = state.tabs
    .filter((tab) => tab.workspaceId === currentTab.workspaceId && tab.id !== tabId && !tab.pinned)
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

/** Closes all unpinned tabs for a workspace and selects the nearest pinned tab when needed. */
export function closeAllTabsState(
  state: WorkspaceTabStateSlice,
  tabId: string,
): Partial<WorkspaceTabStateSlice> | null {
  const currentTab = state.tabs.find((tab) => tab.id === tabId);
  if (!currentTab) {
    return null;
  }

  const tabs = state.tabs.filter((tab) => tab.workspaceId !== currentTab.workspaceId || tab.pinned);
  const removedTabIds = state.tabs
    .filter((tab) => tab.workspaceId === currentTab.workspaceId && !tab.pinned)
    .map((tab) => tab.id);
  const selectedTabBelongsToWorkspace = state.tabs.some(
    (tab) => tab.id === state.selectedTabId && tab.workspaceId === currentTab.workspaceId,
  );
  const nextSelectedTabId = selectedTabBelongsToWorkspace
    ? (tabs.find((tab) => tab.workspaceId === currentTab.workspaceId)?.id ?? "")
    : state.selectedTabId;

  return {
    tabs,
    ...removeTabMetadataById(state, removedTabIds),
    selectedTabId: nextSelectedTabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [currentTab.workspaceId]: nextSelectedTabId,
    },
  };
}
