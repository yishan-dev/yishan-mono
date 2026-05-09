import { buildTabDataByInput, getFileName } from "../tabs";
import type { OpenWorkspaceTabInput, WorkspaceTab } from "../types";
import { findExistingTab } from "./shared";
import type { WorkspaceTabStateSlice } from "./types";

/** Returns one reusable temporary file tab in the target workspace. */
function findTemporaryFileTab(
  tabs: WorkspaceTab[],
  workspaceId: string,
): Extract<WorkspaceTab, { kind: "file" }> | null {
  for (const tab of tabs) {
    if (tab.workspaceId === workspaceId && tab.kind === "file" && tab.data.isTemporary) {
      return tab;
    }
  }

  return null;
}

/** Returns one reusable temporary image tab in the target workspace. */
function findTemporaryImageTab(
  tabs: WorkspaceTab[],
  workspaceId: string,
): Extract<WorkspaceTab, { kind: "image" }> | null {
  for (const tab of tabs) {
    if (tab.workspaceId === workspaceId && tab.kind === "image" && tab.data.isTemporary) {
      return tab;
    }
  }

  return null;
}

/** Returns one state patch that selects one tab in one workspace. */
function selectWorkspaceTab(
  state: WorkspaceTabStateSlice,
  workspaceId: string,
  tabId: string,
): Partial<WorkspaceTabStateSlice> {
  return {
    selectedTabId: tabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [workspaceId]: tabId,
    },
  };
}

/** Builds a new tab entity from a tab-open payload. */
function createTabFromOpenInput(input: OpenWorkspaceTabInput, workspaceId: string, tabId: string): WorkspaceTab {
  if (input.kind === "diff") {
    return {
      id: tabId,
      workspaceId,
      title: getFileName(input.path),
      pinned: false,
      kind: "diff",
      data: buildTabDataByInput(input),
    };
  }

  if (input.kind === "file") {
    return {
      id: tabId,
      workspaceId,
      title: getFileName(input.path),
      pinned: false,
      kind: "file",
      data: buildTabDataByInput(input),
    };
  }

  if (input.kind === "image") {
    return {
      id: tabId,
      workspaceId,
      title: getFileName(input.path),
      pinned: false,
      kind: "image",
      data: buildTabDataByInput(input),
    };
  }

  return {
    id: tabId,
    workspaceId,
    title: input.title?.trim() || "Terminal",
    pinned: false,
    kind: "terminal",
    data: {
      ...buildTabDataByInput(input),
      paneId: `pane-${tabId}`,
    },
  };
}

/** Opens or focuses a tab using workspace+path/title identity rules. */
export function openTabState(
  state: WorkspaceTabStateSlice,
  input: OpenWorkspaceTabInput,
  nextTabId: string,
): Partial<WorkspaceTabStateSlice> | null {
  const targetWorkspaceId = input.workspaceId ?? state.selectedWorkspaceId;
  if (!targetWorkspaceId) {
    return null;
  }

  const existingTab = findExistingTab(state.tabs, input, targetWorkspaceId);
  if (existingTab) {
    if (input.kind === "diff" && existingTab.kind === "diff") {
      const nextOldContent = input.oldContent;
      const nextNewContent = input.newContent;

      if (typeof nextOldContent !== "string" || typeof nextNewContent !== "string") {
        return {
          selectedTabId: existingTab.id,
          selectedTabIdByWorkspaceId: {
            ...state.selectedTabIdByWorkspaceId,
            [targetWorkspaceId]: existingTab.id,
          },
        };
      }

      return {
        tabs: state.tabs.map((tab) =>
          tab.id === existingTab.id && tab.kind === "diff"
            ? {
                ...tab,
                data: {
                  ...tab.data,
                  oldContent: nextOldContent,
                  newContent: nextNewContent,
                  source: input.diffSource,
                },
              }
            : tab,
        ),
        selectedTabId: existingTab.id,
        selectedTabIdByWorkspaceId: {
          ...state.selectedTabIdByWorkspaceId,
          [targetWorkspaceId]: existingTab.id,
        },
      };
    }

    if (input.kind === "file" && existingTab.kind === "file") {
      const nextContent = input.content;
      const isOpeningTemporary = Boolean(input.temporary);
      if (typeof nextContent !== "string") {
        if (existingTab.data.isTemporary === isOpeningTemporary) {
          return selectWorkspaceTab(state, targetWorkspaceId, existingTab.id);
        }

        return {
          tabs: state.tabs.map((tab) =>
            tab.id === existingTab.id && tab.kind === "file"
              ? {
                  ...tab,
                  data: {
                    ...tab.data,
                    isTemporary: isOpeningTemporary,
                  },
                }
              : tab,
          ),
          ...selectWorkspaceTab(state, targetWorkspaceId, existingTab.id),
        };
      }

      return {
        tabs: state.tabs.map((tab) =>
          tab.id === existingTab.id && tab.kind === "file"
            ? {
                ...tab,
                data: {
                  ...tab.data,
                  content: nextContent,
                  savedContent: nextContent,
                  isDirty: false,
                  isTemporary: isOpeningTemporary,
                },
              }
            : tab,
        ),
        ...selectWorkspaceTab(state, targetWorkspaceId, existingTab.id),
      };
    }

    if (input.kind === "image" && existingTab.kind === "image") {
      const isOpeningTemporary = Boolean(input.temporary);
      return {
        tabs: state.tabs.map((tab) =>
          tab.id === existingTab.id && tab.kind === "image"
            ? {
                ...tab,
                data: {
                  ...tab.data,
                  dataUrl: input.dataUrl,
                  isTemporary: isOpeningTemporary,
                },
              }
            : tab,
        ),
        ...selectWorkspaceTab(state, targetWorkspaceId, existingTab.id),
      };
    }

    return selectWorkspaceTab(state, targetWorkspaceId, existingTab.id);
  }

  if (input.kind === "image" && input.temporary) {
    const temporaryImageTab = findTemporaryImageTab(state.tabs, targetWorkspaceId);
    if (temporaryImageTab) {
      return {
        tabs: state.tabs.map((tab) =>
          tab.id === temporaryImageTab.id && tab.kind === "image"
            ? {
                ...tab,
                title: getFileName(input.path),
                data: {
                  ...tab.data,
                  path: input.path,
                  dataUrl: input.dataUrl,
                  isTemporary: true,
                },
              }
            : tab,
        ),
        ...selectWorkspaceTab(state, targetWorkspaceId, temporaryImageTab.id),
      };
    }
  }

  if (input.kind === "file" && input.temporary) {
    const temporaryTab = findTemporaryFileTab(state.tabs, targetWorkspaceId);
    if (temporaryTab) {
      const nextContent = input.content;
      return {
        tabs: state.tabs.map((tab) =>
          tab.id === temporaryTab.id && tab.kind === "file"
            ? {
                ...tab,
                title: getFileName(input.path),
                data: {
                  ...tab.data,
                  path: input.path,
                  content: typeof nextContent === "string" ? nextContent : tab.data.content,
                  savedContent: typeof nextContent === "string" ? nextContent : tab.data.savedContent,
                  isDirty: false,
                  isTemporary: true,
                },
              }
            : tab,
        ),
        ...selectWorkspaceTab(state, targetWorkspaceId, temporaryTab.id),
      };
    }
  }

  const nextTab = createTabFromOpenInput(input, targetWorkspaceId, nextTabId);
  return {
    tabs: [...state.tabs, nextTab],
    selectedTabId: nextTabId,
    selectedTabIdByWorkspaceId: {
      ...state.selectedTabIdByWorkspaceId,
      [targetWorkspaceId]: nextTabId,
    },
  };
}
