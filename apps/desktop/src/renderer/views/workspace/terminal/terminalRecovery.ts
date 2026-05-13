import { tabStore } from "../../../store/tabStore";
import type { TabStoreState } from "../../../store/tabStore";
import { workspaceStore } from "../../../store/workspaceStore";

type TerminalTab = Extract<TabStoreState["tabs"][number], { kind: "terminal" }>;

type PersistedTerminalTabEntry = {
  tabId: string;
  workspaceId: string;
  title: string;
  pinned: boolean;
  sessionId?: string;
  launchCommand?: string;
};

type PersistedTerminalTabPayload = {
  selectedTabId: string;
  tabs: PersistedTerminalTabEntry[];
};

const TERMINAL_RECOVERY_STORAGE_KEY = "yishan-terminal-recovery-v1";
const EMPTY_PERSISTED_TERMINAL_PAYLOAD: PersistedTerminalTabPayload = {
  selectedTabId: "",
  tabs: [],
};

/** Clears persisted terminal recovery data from localStorage. */
export function clearTerminalRecoveryStorage(storage: Storage | undefined = resolveBrowserStorage()): void {
  if (!storage) {
    return;
  }
  storage.removeItem(TERMINAL_RECOVERY_STORAGE_KEY);
}

/**
 * Coordinates terminal tab persistence and restore.
 */
export class TerminalRecoveryCoordinator {
  constructor(
    private readonly tabStoreAccess: Pick<typeof tabStore, "getState" | "setState" | "subscribe"> = tabStore,
    private readonly workspaceStoreAccess: Pick<typeof workspaceStore, "getState"> = workspaceStore,
    private readonly storage: Storage | undefined = resolveBrowserStorage(),
  ) {}

  /**
   * Restores persisted terminal tabs into tab store once workspace metadata is available.
   * Returns workspace id for the selected tab after restore, if any.
   */
  restoreTerminalTabsFromRegistry(): string | undefined {
    const persisted = this.loadPersistedTerminalTabs();
    if (persisted.tabs.length === 0) {
      return undefined;
    }

    const workspaceIdSet = new Set(this.workspaceStoreAccess.getState().workspaces.map((workspace) => workspace.id));
    if (workspaceIdSet.size === 0) {
      return undefined;
    }

    this.tabStoreAccess.setState((state) => {
      const existingTabIds = new Set(state.tabs.map((tab) => tab.id));
      const restoredTabs: TerminalTab[] = persisted.tabs
        .filter((entry) => workspaceIdSet.has(entry.workspaceId))
        .filter((entry) => !existingTabIds.has(entry.tabId))
        .map((entry) => ({
          id: entry.tabId,
          workspaceId: entry.workspaceId,
          title: entry.title,
          pinned: entry.pinned,
          kind: "terminal" as const,
          data: {
            title: entry.title,
            sessionId: entry.sessionId,
            launchCommand: entry.launchCommand,
          },
        }));

      if (restoredTabs.length === 0) {
        return state;
      }

      const nextTabs = [...state.tabs, ...restoredTabs];
      const nextSelectedByWorkspaceId = { ...state.selectedTabIdByWorkspaceId };
      for (const tab of restoredTabs) {
        if (!nextSelectedByWorkspaceId[tab.workspaceId]) {
          nextSelectedByWorkspaceId[tab.workspaceId] = tab.id;
        }
      }

      const shouldRestoreSelectedTab =
        persisted.selectedTabId && nextTabs.some((tab) => tab.id === persisted.selectedTabId);
      if (shouldRestoreSelectedTab) {
        const restoredSelectedTab = nextTabs.find((tab) => tab.id === persisted.selectedTabId);
        if (restoredSelectedTab) {
          nextSelectedByWorkspaceId[restoredSelectedTab.workspaceId] = restoredSelectedTab.id;
        }
      }

      return {
        tabs: nextTabs,
        selectedTabIdByWorkspaceId: nextSelectedByWorkspaceId,
        selectedTabId: shouldRestoreSelectedTab ? persisted.selectedTabId : state.selectedTabId,
      };
    });
    const restoredState = this.tabStoreAccess.getState();
    if (this.storage) {
      this.storage.setItem(
        TERMINAL_RECOVERY_STORAGE_KEY,
        JSON.stringify(this.buildPersistedTerminalTabsPayload(restoredState)),
      );
    }
    return restoredState.tabs.find((tab) => tab.id === restoredState.selectedTabId)?.workspaceId;
  }

  /**
   * Starts auto-persisting terminal-tab metadata and returns the unsubscribe handle.
   */
  startPersistingTerminalTabs(): () => void {
    let previousSerializedPayload = JSON.stringify(
      this.buildPersistedTerminalTabsPayload(this.tabStoreAccess.getState()),
    );

    return this.tabStoreAccess.subscribe((state) => {
      const nextSerializedPayload = JSON.stringify(this.buildPersistedTerminalTabsPayload(state));
      if (nextSerializedPayload === previousSerializedPayload) {
        return;
      }

      previousSerializedPayload = nextSerializedPayload;
      if (!this.storage) {
        return;
      }

      this.storage.setItem(TERMINAL_RECOVERY_STORAGE_KEY, nextSerializedPayload);
    });
  }

  /** Reads persisted terminal tabs from local storage with strict validation. */
  private loadPersistedTerminalTabs(): PersistedTerminalTabPayload {
    if (!this.storage) {
      return EMPTY_PERSISTED_TERMINAL_PAYLOAD;
    }

    try {
      const raw = this.storage.getItem(TERMINAL_RECOVERY_STORAGE_KEY);
      if (!raw) {
        return EMPTY_PERSISTED_TERMINAL_PAYLOAD;
      }

      const parsed = JSON.parse(raw) as {
        selectedTabId?: unknown;
        tabs?: unknown;
      };
      const selectedTabId = typeof parsed.selectedTabId === "string" ? parsed.selectedTabId : "";
      const tabs = Array.isArray(parsed.tabs)
        ? parsed.tabs
            .map((entry) => normalizePersistedTerminalTabEntry(entry))
            .filter((entry): entry is PersistedTerminalTabEntry => Boolean(entry))
        : [];

      return {
        selectedTabId,
        tabs,
      };
    } catch {
      return EMPTY_PERSISTED_TERMINAL_PAYLOAD;
    }
  }

  /** Builds the persisted terminal-tab payload from current tab-store state. */
  private buildPersistedTerminalTabsPayload(
    state: Pick<TabStoreState, "tabs" | "selectedTabId">,
  ): PersistedTerminalTabPayload {
    return {
      selectedTabId: state.selectedTabId,
      tabs: state.tabs
        .filter((tab): tab is TerminalTab => tab.kind === "terminal")
        .map((tab) => ({
          tabId: tab.id,
          workspaceId: tab.workspaceId,
          title: tab.title,
          pinned: tab.pinned,
          sessionId: normalizeOptionalText(tab.data.sessionId),
          launchCommand: normalizeOptionalText(tab.data.launchCommand),
        })),
    };
  }
}

/** Resolves one browser storage object when runtime environment supports localStorage. */
function resolveBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

/** Normalizes one optional text field and returns undefined for blank values. */
function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

/** Parses and validates one persisted terminal tab entry. */
function normalizePersistedTerminalTabEntry(value: unknown): PersistedTerminalTabEntry | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const entry = value as Partial<PersistedTerminalTabEntry>;
  const tabId = normalizeOptionalText(entry.tabId);
  const workspaceId = normalizeOptionalText(entry.workspaceId);
  const title = normalizeOptionalText(entry.title);
  if (!tabId || !workspaceId || !title) {
    return undefined;
  }

  return {
    tabId,
    workspaceId,
    title,
    pinned: Boolean(entry.pinned),
    sessionId: normalizeOptionalText(entry.sessionId),
    launchCommand: normalizeOptionalText(entry.launchCommand),
  };
}
