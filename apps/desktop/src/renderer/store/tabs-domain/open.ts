import { buildTabDataByInput, getFileName } from "../tabs";
import type { OpenWorkspaceTabInput, WorkspaceTab } from "../types";
import { findExistingTab } from "./shared";
import type { WorkspaceTabStateSlice } from "./types";

function isTemporaryTab(tab: WorkspaceTab): boolean {
  return (
    (tab.kind === "file" && tab.data.isTemporary) ||
    (tab.kind === "image" && tab.data.isTemporary) ||
    (tab.kind === "diff" && tab.data.isTemporary)
  );
}

/** Returns the single reusable temporary tab in the target workspace, regardless of kind. */
function findTemporaryTab(tabs: WorkspaceTab[], workspaceId: string): WorkspaceTab | null {
  for (const tab of tabs) {
    if (tab.workspaceId === workspaceId && isTemporaryTab(tab)) {
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

  if (input.kind === "browser") {
    return {
      id: tabId,
      workspaceId,
      title: "Browser",
      pinned: false,
      kind: "browser",
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
      const isUnsupported = Boolean(input.isUnsupported);
      const unsupportedReason = input.unsupportedReason;
      if (typeof nextContent !== "string") {
        if (
          existingTab.data.isTemporary === isOpeningTemporary &&
          Boolean(existingTab.data.isUnsupported) === isUnsupported
        ) {
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
                    ...(isUnsupported ? { isUnsupported: true } : {}),
                    ...(unsupportedReason ? { unsupportedReason } : {}),
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
                  ...(isUnsupported ? { isUnsupported: true } : {}),
                  ...(unsupportedReason ? { unsupportedReason } : {}),
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

    if (input.kind === "browser" && existingTab.kind === "browser") {
      const nextUrl = input.url?.trim();
      if (!nextUrl || nextUrl === existingTab.data.url) {
        return selectWorkspaceTab(state, targetWorkspaceId, existingTab.id);
      }

      return {
        tabs: state.tabs.map((tab) =>
          tab.id === existingTab.id && tab.kind === "browser"
            ? {
                ...tab,
                data: {
                  ...tab.data,
                  url: nextUrl,
                },
              }
            : tab,
        ),
        ...selectWorkspaceTab(state, targetWorkspaceId, existingTab.id),
      };
    }

    return selectWorkspaceTab(state, targetWorkspaceId, existingTab.id);
  }

  if ((input.kind === "file" || input.kind === "image" || input.kind === "diff") && input.temporary) {
    const existing = findTemporaryTab(state.tabs, targetWorkspaceId);
    if (existing) {
      const replacement = createTabFromOpenInput(input, targetWorkspaceId, existing.id);
      return {
        tabs: state.tabs.map((tab) => (tab.id === existing.id ? replacement : tab)),
        ...selectWorkspaceTab(state, targetWorkspaceId, existing.id),
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
