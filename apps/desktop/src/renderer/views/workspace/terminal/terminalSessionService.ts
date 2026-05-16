import {
  closeTab,
  renameTab,
} from "../../../commands/tabCommands";
import {
  createTerminalSession,
  listTerminalSessions,
  readTerminalOutput,
  resizeTerminal,
  subscribeTerminalOutput,
  writeTerminalInput,
} from "../../../commands/terminalCommands";
import { tabStore } from "../../../store/tabStore";
import type { WorkspaceTab } from "../../../store/types";
import {
  shouldClearTerminalOutputShortcut,
  shouldReleaseCommandWForTabCloseShortcut,
} from "./terminalKeyboardUtils";
import {
  ensureTerminalRuntime,
  getTerminalRuntime,
  isRuntimeVersionMatch,
  reportTerminalAsyncError,
  setTerminalDisposeHandler,
  setTerminalOutputSubscription,
  setTerminalReattachHandler,
  setTerminalResizeHandler,
  setTerminalSessionId,
  updateTerminalReadIndex,
} from "./terminalRuntimeRegistry";
import type { TerminalRuntimeEntry } from "./terminalRuntimeRegistry";
import { TerminalSessionOrchestrator } from "./terminalSessionOrchestrator";
import {
  formatTerminalCommandTitle,
  formatTerminalPathTitle,
  resolveTerminalWorkspacePath,
} from "./terminalTitleUtils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type TerminalTab = Extract<WorkspaceTab, { kind: "terminal" }>;

// ─── Module State ──────────────────────────────────────────────────────────────

/**
 * Tracks which tabs have had their session lifecycle started,
 * to prevent duplicate initialization.
 */
const initializedTabs = new Set<string>();

/**
 * Tracks the last applied title per tab to avoid redundant rename calls.
 */
const lastAppliedTitleByTabId = new Map<string, string>();

// Register handlers with the registry (avoiding circular imports).
setTerminalResizeHandler(sendTerminalResize);
setTerminalDisposeHandler(cleanupTerminalSessionLifecycle);
setTerminalReattachHandler(handleReattach);

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Initializes the terminal session lifecycle for a given tab.
 * Idempotent — calling multiple times for the same tabId is a no-op.
 */
export function initTerminalSessionLifecycle(tabId: string): void {
  if (initializedTabs.has(tabId)) {
    return;
  }
  initializedTabs.add(tabId);

  const entry = ensureTerminalRuntime(tabId);

  // Set up keyboard shortcuts, input forwarding, and title tracking.
  setupKeyboardShortcuts(entry);
  setupInputForwarding(entry);
  setupTitleTracking(entry, tabId);

  // Kick off session resolution asynchronously.
  const version = entry.version;
  void resolveAndSubscribeSession(entry, tabId, version).catch((error) => {
    reportTerminalAsyncError("init terminal session lifecycle", error);
  });
}

/**
 * Cleans up session lifecycle tracking for a disposed tab.
 */
export function cleanupTerminalSessionLifecycle(tabId: string): void {
  initializedTabs.delete(tabId);
  lastAppliedTitleByTabId.delete(tabId);
}

/**
 * Returns the session ID for a tab (if resolved), for use by resize handlers.
 */
export function getTerminalSessionId(tabId: string): string | null {
  const entry = getTerminalRuntime(tabId);
  return entry?.sessionId ?? null;
}

/**
 * Sends a resize command to the PTY for the given tab's current terminal dimensions.
 */
export function sendTerminalResize(tabId: string): void {
  const entry = getTerminalRuntime(tabId);
  if (!entry?.sessionId) {
    return;
  }

  void resizeTerminal({
    sessionId: entry.sessionId,
    cols: entry.terminal.cols,
    rows: entry.terminal.rows,
  }).catch((error) => {
    reportTerminalAsyncError("resize terminal", error);
  });
}

/**
 * Called by the registry when a previously-detached terminal is reattached.
 * Checks if the session exited while detached and closes the tab.
 */
export function handleReattach(tabId: string): void {
  const entry = getTerminalRuntime(tabId);
  if (!entry) {
    return;
  }

  if (entry.exited && !entry.didRequestClose) {
    entry.didRequestClose = true;
    closeTab(tabId);
  }
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function setupKeyboardShortcuts(entry: TerminalRuntimeEntry): void {
  entry.terminal.attachCustomKeyEventHandler((event) => {
    if (shouldReleaseCommandWForTabCloseShortcut(event)) {
      return false;
    }

    if (shouldClearTerminalOutputShortcut(event)) {
      if (event.type === "keydown") {
        entry.terminal.clear();
      }
      return false;
    }

    if (!(event.shiftKey && event.key === "Enter")) {
      return true;
    }

    if (event.type !== "keydown") {
      return false;
    }

    if (!entry.sessionId) {
      return false;
    }

    entry.terminal.paste("\n");
    return false;
  });
}

function setupInputForwarding(entry: TerminalRuntimeEntry): void {
  entry.terminal.onData((data) => {
    const sessionId = entry.sessionId;
    if (!sessionId) {
      return;
    }

    void writeTerminalInput({ sessionId, data }).catch((error) => {
      reportTerminalAsyncError("write terminal input", error);
    });
  });
}

function setupTitleTracking(entry: TerminalRuntimeEntry, tabId: string): void {
  entry.terminal.onTitleChange((title) => {
    applyTitleFromCommand(tabId, title);
  });
}

async function resolveAndSubscribeSession(
  entry: TerminalRuntimeEntry,
  tabId: string,
  version: number,
): Promise<void> {
  const orchestrator = new TerminalSessionOrchestrator({
    createTerminalSession,
    listTerminalSessions,
    readTerminalOutput,
    resizeTerminal,
    writeTerminalInput,
  });

  const restored = await orchestrator.attachOrCreateAndRestore({
    tabId,
    terminal: entry.terminal,
    fitAddon: entry.fitAddon,
  });

  // Guard: reject stale completions if runtime was disposed or recreated.
  if (!isRuntimeVersionMatch(tabId, version)) {
    return;
  }

  if (!restored) {
    return;
  }

  // Store session info on the runtime entry.
  entry.sessionId = restored.sessionId;
  entry.readIndex = restored.nextIndex;
  entry.didRequestClose = false;
  setTerminalSessionId(tabId, restored.sessionId);
  updateTerminalReadIndex(tabId, restored.nextIndex);

  // Apply initial title.
  const terminalTab = findTerminalTab(tabId);
  if (terminalTab?.data.launchCommand) {
    applyTitleFromCommand(tabId, terminalTab.data.launchCommand);
  } else {
    applyTitleFromPath(tabId, resolveTerminalWorkspacePath(terminalTab));
  }

  // Subscribe to live output — this subscription survives detach/attach.
  const subscription = await subscribeTerminalOutput({
    sessionId: restored.sessionId,
    onData: (payload) => {
      // Guard against stale callbacks if runtime was disposed.
      if (!isRuntimeVersionMatch(tabId, version)) {
        return;
      }

      if (payload.sessionId !== entry.sessionId) {
        return;
      }

      if (payload.type === "output") {
        if (payload.nextIndex <= entry.readIndex) {
          return;
        }
        entry.readIndex = payload.nextIndex;
        updateTerminalReadIndex(tabId, payload.nextIndex);

        const { chunk } = payload;
        if (chunk instanceof Uint8Array) {
          if (chunk.byteLength > 0) {
            entry.writeQueue.enqueue(chunk);
          }
        } else if (typeof chunk === "string" && chunk.length > 0) {
          entry.writeQueue.enqueue(chunk);
        }
        return;
      }

      // Exit event.
      if (entry.didRequestClose) {
        return;
      }
      entry.didRequestClose = true;
      entry.exited = true;

      if (entry.state === "attached" || entry.state === "attaching") {
        closeTab(tabId);
      }
      // If detached, handleReattach will close on next attach.
    },
    onError: (error) => {
      reportTerminalAsyncError("subscribe terminal output", error);
    },
  });

  // Guard: reject stale subscription if runtime was disposed during async subscribe.
  if (!isRuntimeVersionMatch(tabId, version)) {
    subscription.unsubscribe();
    return;
  }

  setTerminalOutputSubscription(tabId, subscription);

  // If session already exited before we subscribed, handle now.
  if (restored.exited && !entry.didRequestClose) {
    entry.didRequestClose = true;
    entry.exited = true;
    if (entry.state === "attached" || entry.state === "attaching") {
      closeTab(tabId);
    }
  }
}

function applyTitleFromCommand(tabId: string, command: string): void {
  if (isUserRenamed(tabId)) {
    return;
  }
  const title = formatTerminalCommandTitle(command);
  if (!title || title === lastAppliedTitleByTabId.get(tabId)) {
    return;
  }
  lastAppliedTitleByTabId.set(tabId, title);
  renameTab(tabId, title);
}

function applyTitleFromPath(tabId: string, path: string | undefined): void {
  if (isUserRenamed(tabId)) {
    return;
  }
  const title = formatTerminalPathTitle(path);
  if (!title || title === lastAppliedTitleByTabId.get(tabId)) {
    return;
  }
  lastAppliedTitleByTabId.set(tabId, title);
  renameTab(tabId, title);
}

function isUserRenamed(tabId: string): boolean {
  const tab = findTerminalTab(tabId);
  return tab?.data.userRenamed === true;
}

function findTerminalTab(tabId: string): TerminalTab | undefined {
  return tabStore
    .getState()
    .tabs.find(
      (candidate): candidate is TerminalTab =>
        candidate.id === tabId && candidate.kind === "terminal",
    );
}
