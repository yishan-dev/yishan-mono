import type { WorkspaceTabStateSlice } from "./types";

/** Toggles pinned state for one tab id. */
export function toggleTabPinnedState(state: WorkspaceTabStateSlice, tabId: string): Partial<WorkspaceTabStateSlice> {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            pinned: !tab.pinned,
          }
        : tab,
    ),
  };
}

/** Renames one tab id while preserving all other tab fields. */
export function renameTabState(
  state: WorkspaceTabStateSlice,
  tabId: string,
  title: string,
): Partial<WorkspaceTabStateSlice> {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === tabId
        ? {
            ...tab,
            title,
          }
        : tab,
    ),
  };
}

/** Updates editable content for one file tab and recomputes dirty state. */
export function updateFileTabContentState(
  state: WorkspaceTabStateSlice,
  tabId: string,
  content: string,
): Partial<WorkspaceTabStateSlice> {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === tabId && tab.kind === "file"
        ? {
            ...tab,
            data: {
              ...tab.data,
              content,
              isDirty: content !== tab.data.savedContent,
            },
          }
        : tab,
    ),
  };
}

/** Marks one file tab as saved by syncing savedContent and dirty state. */
export function markFileTabSavedState(state: WorkspaceTabStateSlice, tabId: string): Partial<WorkspaceTabStateSlice> {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === tabId && tab.kind === "file"
        ? {
            ...tab,
            data: {
              ...tab.data,
              savedContent: tab.data.content,
              isDirty: false,
            },
          }
        : tab,
    ),
  };
}

/** Reorders tabs inside one workspace and pin-group while preserving global list shape. */
export function reorderTabState(
  state: WorkspaceTabStateSlice,
  draggedTabId: string,
  targetTabId: string,
  position: "before" | "after",
): Partial<WorkspaceTabStateSlice> | null {
  if (draggedTabId === targetTabId) {
    return null;
  }

  const draggedTab = state.tabs.find((tab) => tab.id === draggedTabId);
  const targetTab = state.tabs.find((tab) => tab.id === targetTabId);
  if (!draggedTab || !targetTab) {
    return null;
  }

  if (draggedTab.workspaceId !== targetTab.workspaceId || draggedTab.pinned !== targetTab.pinned) {
    return null;
  }

  const scopedTabs = state.tabs.filter(
    (tab) => tab.workspaceId === draggedTab.workspaceId && tab.pinned === draggedTab.pinned,
  );
  const tabsWithoutDragged = scopedTabs.filter((tab) => tab.id !== draggedTabId);
  const targetIndex = tabsWithoutDragged.findIndex((tab) => tab.id === targetTabId);
  if (targetIndex < 0) {
    return null;
  }

  const insertAt = position === "before" ? targetIndex : targetIndex + 1;
  const reorderedScopedTabs = [...tabsWithoutDragged];
  reorderedScopedTabs.splice(insertAt, 0, draggedTab);

  let scopedTabCursor = 0;
  return {
    tabs: state.tabs.map((tab) => {
      const inScope = tab.workspaceId === draggedTab.workspaceId && tab.pinned === draggedTab.pinned;
      if (!inScope) {
        return tab;
      }

      const nextTab = reorderedScopedTabs[scopedTabCursor];
      scopedTabCursor += 1;
      return nextTab ?? tab;
    }),
    selectedTabId: draggedTabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [draggedTab.workspaceId]: draggedTabId,
    },
  };
}
