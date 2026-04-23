import { describe, expect, it, vi } from "vitest";
import type { TabStoreState } from "../../store/tabStore";
import type { WorkspaceStoreState } from "../../store/types";
import { TerminalRecoveryCoordinator } from "./terminalRecovery";

/** Builds an in-memory Storage mock. */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

/** Creates a minimal mutable tab-store facade used by terminal recovery tests. */
function createTabStoreAccess(input: {
  tabs: TabStoreState["tabs"];
  selectedTabId?: string;
  selectedTabIdByWorkspaceId?: Record<string, string>;
}) {
  let state = {
    tabs: input.tabs,
    selectedTabId: input.selectedTabId ?? "",
    selectedTabIdByWorkspaceId: input.selectedTabIdByWorkspaceId ?? {},
    setTerminalTabSessionId: (tabId: string, sessionId: string) => {
      state.tabs = state.tabs.map((tab) =>
        tab.id === tabId && tab.kind === "terminal"
          ? {
              ...tab,
              data: {
                ...tab.data,
                sessionId,
              },
            }
          : tab,
      );
    },
  } as unknown as TabStoreState;

  const subscribers: Array<(nextState: TabStoreState) => void> = [];
  const subscribe = vi.fn((listener: (nextState: TabStoreState) => void) => {
    subscribers.push(listener);
    return () => {
      const index = subscribers.indexOf(listener);
      if (index >= 0) {
        subscribers.splice(index, 1);
      }
    };
  });

  return {
    getState: () => state,
    setState: (patch: unknown) => {
      const nextPatch = typeof patch === "function" ? patch(state) : patch;
      state = {
        ...state,
        ...(nextPatch as Partial<TabStoreState>),
      } as TabStoreState;
    },
    emit: () => {
      for (const subscriber of subscribers) {
        subscriber(state);
      }
    },
    subscribe,
  };
}

/** Creates a minimal workspace-store facade used by terminal recovery tests. */
function createWorkspaceStoreAccess(workspaceId: string, worktreePath: string) {
  const state = {
    selectedWorkspaceId: workspaceId,
    workspaces: [
      {
        id: workspaceId,
        repoId: "repo-1",
        name: "Workspace",
        title: "Workspace",
        sourceBranch: "origin/main",
        branch: "main",
        summaryId: "summary-1",
        worktreePath,
      },
    ],
  } as unknown as WorkspaceStoreState;

  return {
    getState: () => state,
  };
}

describe("TerminalRecoveryCoordinator", () => {
  it("restores persisted terminal tabs for existing workspaces", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "yishan-terminal-recovery-v1",
      JSON.stringify({
        selectedTabId: "terminal-1",
        tabs: [
          {
            tabId: "terminal-1",
            workspaceId: "workspace-1",
            title: "Terminal",
            pinned: false,
            sessionId: "session-1",
          },
          {
            tabId: "terminal-missing-workspace",
            workspaceId: "workspace-missing",
            title: "Terminal",
            pinned: false,
            sessionId: "session-2",
          },
        ],
      }),
    );

    const tabStoreAccess = createTabStoreAccess({
      tabs: [],
      selectedTabId: "",
      selectedTabIdByWorkspaceId: {
        "workspace-1": "stale-tab-id",
      },
    });

    const coordinator = new TerminalRecoveryCoordinator(
      tabStoreAccess as never,
      createWorkspaceStoreAccess("workspace-1", "/tmp/workspace-1") as never,
      storage,
    );

    const restoredWorkspaceId = coordinator.restoreTerminalTabsFromRegistry();

    const restoredTabs = tabStoreAccess.getState().tabs;
    expect(restoredTabs).toHaveLength(1);
    expect(restoredTabs[0]).toMatchObject({
      id: "terminal-1",
      workspaceId: "workspace-1",
      kind: "terminal",
    });
    expect(tabStoreAccess.getState().selectedTabId).toBe("terminal-1");
    expect(tabStoreAccess.getState().selectedTabIdByWorkspaceId["workspace-1"]).toBe("terminal-1");
    expect(restoredWorkspaceId).toBe("workspace-1");
    expect(JSON.parse(storage.getItem("yishan-terminal-recovery-v1") ?? "{}")).toEqual({
      selectedTabId: "terminal-1",
      tabs: [
        {
          tabId: "terminal-1",
          workspaceId: "workspace-1",
          title: "Terminal",
          pinned: false,
          sessionId: "session-1",
        },
      ],
    });
  });

  it("persists only when terminal recovery payload changes", () => {
    const storage = createMemoryStorage();
    const setItemSpy = vi.spyOn(storage, "setItem");
    const tabStoreAccess = createTabStoreAccess({
      tabs: [
        {
          id: "file-tab-1",
          workspaceId: "workspace-1",
          title: "README.md",
          pinned: false,
          kind: "file",
          data: {
            path: "README.md",
            content: "",
            savedContent: "",
            isDirty: false,
            isTemporary: false,
          },
        },
        {
          id: "terminal-tab-1",
          workspaceId: "workspace-1",
          title: "Terminal",
          pinned: false,
          kind: "terminal",
          data: {
            title: "Terminal",
            sessionId: "session-1",
          },
        },
      ],
      selectedTabId: "terminal-tab-1",
      selectedTabIdByWorkspaceId: {
        "workspace-1": "terminal-tab-1",
      },
    });
    const coordinator = new TerminalRecoveryCoordinator(
      tabStoreAccess as never,
      createWorkspaceStoreAccess("workspace-1", "/tmp/workspace-1") as never,
      storage,
    );
    const unsubscribe = coordinator.startPersistingTerminalTabs();

    tabStoreAccess.emit();
    expect(setItemSpy).toHaveBeenCalledTimes(0);

    tabStoreAccess.setState((state: TabStoreState) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === "file-tab-1" && tab.kind === "file"
          ? {
              ...tab,
              title: "README_NEW.md",
            }
          : tab,
      ),
    }));
    tabStoreAccess.emit();
    expect(setItemSpy).toHaveBeenCalledTimes(0);

    tabStoreAccess.setState((state: TabStoreState) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === "terminal-tab-1" && tab.kind === "terminal"
          ? {
              ...tab,
              data: {
                ...tab.data,
                sessionId: "session-2",
              },
            }
          : tab,
      ),
    }));
    tabStoreAccess.emit();
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    tabStoreAccess.emit();
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
