// @vitest-environment jsdom

import { ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIONS, type AppActionPayload } from "../../../shared/contracts/actions";
import { AppThemePreferenceProvider } from "../../hooks/useThemePreference";
import { LAYOUT_STORE_STORAGE_KEY, layoutStore } from "../../store/layoutStore";
import { tabStore } from "../../store/tabStore";
import { workspaceFileTreeStore } from "../../store/workspaceFileTreeStore";
import { workspaceStore } from "../../store/workspaceStore";
import { createAppTheme } from "../../theme";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => ({
  toggleMainWindowMaximized: vi.fn(async () => ({ ok: true as const })),
  subscribeAppActionEvent: vi.fn(),
  appActionListener: null as ((payload: AppActionPayload) => void) | null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../commands/appCommands", () => ({
  openLocalFolderDialog: vi.fn(),
  getDefaultWorktreeLocation: vi.fn(),
  checkAgentGlobalConfigExternalDirectoryPermission: vi.fn(),
  ensureAgentGlobalConfigExternalDirectoryPermission: vi.fn(),
  toggleMainWindowMaximized: mocks.toggleMainWindowMaximized,
}));

vi.mock("../../events", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    subscribeAppActionEvent: mocks.subscribeAppActionEvent,
  };
});

vi.mock("../../hooks/useShortcuts", () => ({
  useShortcuts: () => {},
}));

function renderShellWithRoutes(input: {
  themeMode: "light" | "dark";
  initialPath?: string;
}) {
  render(
    <ThemeProvider theme={createAppTheme(input.themeMode)}>
      <AppThemePreferenceProvider>
        <MemoryRouter initialEntries={[input.initialPath ?? "/settings"]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/settings" element={<div>settings</div>} />
              <Route path="/" element={<div>repos</div>} />
              <Route path="/keybindings" element={<div>keybindings</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppThemePreferenceProvider>
    </ThemeProvider>,
  );
}

/** Seeds the workspace store with a repo/workspace/session triplet used for route-sync tests. */
function seedWorkspaceStore() {
  workspaceStore.setState({
    repos: [
      {
        id: "repo-1",
        key: "repo-1",
        name: "Repo 1",
        path: "/tmp/repo-1",
        missing: false,
        worktreePath: "/tmp/repo-1",
      },
    ],
    workspaces: [
      {
        id: "workspace-1",
        repoId: "repo-1",
        name: "workspace-1",
        title: "Workspace 1",
        sourceBranch: "main",
        branch: "main",
        summaryId: "workspace-1",
        worktreePath: "/tmp/repo-1/worktree-1",
      },
    ],
    selectedRepoId: "",
    selectedWorkspaceId: "",
  });

  tabStore.setState({
    tabs: [
      {
        id: "tab-1",
        workspaceId: "workspace-1",
        title: "Tab 1",
        pinned: false,
        kind: "session",
        data: {
          sessionId: "session-1",
          agentKind: "opencode",
          isInitializing: false,
        },
      },
    ],
    selectedWorkspaceId: "",
    selectedTabId: "",
    selectedTabIdByWorkspaceId: {
      "workspace-1": "tab-1",
    },
  });
}

const initialWorkspaceStoreState = workspaceStore.getState();
const initialTabStoreState = tabStore.getState();

beforeEach(() => {
  mocks.appActionListener = null;
  mocks.subscribeAppActionEvent.mockReset();
  mocks.subscribeAppActionEvent.mockImplementation((listener: (payload: AppActionPayload) => void) => {
    mocks.appActionListener = listener;
    return () => {
      mocks.appActionListener = null;
    };
  });
});

afterEach(() => {
  workspaceStore.setState(initialWorkspaceStoreState, true);
  tabStore.setState(initialTabStoreState, true);
  window.localStorage.removeItem(LAYOUT_STORE_STORAGE_KEY);
  layoutStore.setState({ themePreference: "system" });
  layoutStore.setState({ isLeftPaneManuallyHidden: false, isRightPaneManuallyHidden: false });
  workspaceFileTreeStore.setState({
    selectedEntryPath: "",
    deleteSelectionRequestId: 0,
    undoRequestId: 0,
  });
  cleanup();
  vi.clearAllMocks();
});

describe("AppShell", () => {
  it("syncs workspace selection before navigating from navigate action", async () => {
    seedWorkspaceStore();

    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/settings",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    mocks.appActionListener({
      action: ACTIONS.NAVIGATE,
      path: "/?workspaceId=workspace-1&sessionId=session-1",
    });

    await waitFor(() => {
      expect(screen.getByText("repos")).toBeTruthy();
    });

    const nextState = workspaceStore.getState();
    expect(nextState.selectedRepoId).toBe("repo-1");
    expect(nextState.selectedWorkspaceId).toBe("workspace-1");
    expect(tabStore.getState().selectedTabId).toBe("tab-1");
  });

  it("selects explicit workspace tab id from navigate action payload", async () => {
    seedWorkspaceStore();
    tabStore.setState((state) => ({
      ...state,
      tabs: [
        ...(state.tabs ?? []),
        {
          id: "tab-2",
          workspaceId: "workspace-1",
          title: "Tab 2",
          pinned: false,
          kind: "terminal",
          data: {
            title: "Terminal",
            paneId: "pane-tab-2",
          },
        },
      ],
      selectedTabIdByWorkspaceId: {
        "workspace-1": "tab-1",
      },
    }));

    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/settings",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    mocks.appActionListener({
      action: ACTIONS.NAVIGATE,
      path: "/?workspaceId=workspace-1&tabId=tab-2",
    });

    await waitFor(() => {
      expect(screen.getByText("repos")).toBeTruthy();
    });

    expect(tabStore.getState().selectedTabId).toBe("tab-2");
  });

  it("navigates to settings when native settings action is received", async () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    mocks.appActionListener({
      action: ACTIONS.NAVIGATE,
      path: "/settings",
    });

    await waitFor(() => {
      expect(screen.getByText("settings")).toBeTruthy();
    });
  });

  it("requests file-tree delete command when native app action is received", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    const initialDeleteRequestId = workspaceFileTreeStore.getState().deleteSelectionRequestId;
    mocks.appActionListener({
      action: ACTIONS.FILE_DELETE,
    });

    expect(workspaceFileTreeStore.getState().deleteSelectionRequestId).toBe(initialDeleteRequestId + 1);
  });

  it("ignores file-tree delete app action when an input is focused", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const initialDeleteRequestId = workspaceFileTreeStore.getState().deleteSelectionRequestId;
    mocks.appActionListener({
      action: ACTIONS.FILE_DELETE,
    });

    expect(workspaceFileTreeStore.getState().deleteSelectionRequestId).toBe(initialDeleteRequestId);
    input.remove();
  });

  it("requests file-tree delete app action when file tree is focused", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    const treeArea = document.createElement("div");
    treeArea.setAttribute("data-testid", "repo-file-tree-area");
    treeArea.tabIndex = -1;
    const treeItem = document.createElement("span");
    treeArea.appendChild(treeItem);
    document.body.appendChild(treeArea);
    treeArea.focus();

    const initialDeleteRequestId = workspaceFileTreeStore.getState().deleteSelectionRequestId;
    mocks.appActionListener({
      action: ACTIONS.FILE_DELETE,
    });

    expect(workspaceFileTreeStore.getState().deleteSelectionRequestId).toBe(initialDeleteRequestId + 1);
    treeArea.remove();
  });

  it("requests file-tree undo command when native app action is received", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    const initialUndoRequestId = workspaceFileTreeStore.getState().undoRequestId;
    mocks.appActionListener({
      action: ACTIONS.FILE_UNDO,
    });

    expect(workspaceFileTreeStore.getState().undoRequestId).toBe(initialUndoRequestId + 1);
  });

  it("toggles left pane visibility when native toggle-left action is received", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    layoutStore.setState({ isLeftPaneManuallyHidden: false });
    mocks.appActionListener({ action: ACTIONS.TOGGLE_LEFT_PANE });

    expect(layoutStore.getState().isLeftPaneManuallyHidden).toBe(true);
  });

  it("toggles right pane visibility when native toggle-right action is received", () => {
    renderShellWithRoutes({
      themeMode: "light",
      initialPath: "/",
    });

    if (!mocks.appActionListener) {
      throw new Error("Expected app action listener to be registered.");
    }

    layoutStore.setState({ isRightPaneManuallyHidden: false });
    mocks.appActionListener({ action: ACTIONS.TOGGLE_RIGHT_PANE });

    expect(layoutStore.getState().isRightPaneManuallyHidden).toBe(true);
  });
});
