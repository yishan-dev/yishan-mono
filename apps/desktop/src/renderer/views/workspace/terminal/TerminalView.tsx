import { Box } from "@mui/material";
import type { FitAddon } from "@xterm/addon-fit";
import type { SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { memo, useCallback, useEffect, useRef } from "react";
import { useCommands } from "../../../hooks/useCommands";
import { tabStore } from "../../../store/tabStore";
import type { WorkspaceTab } from "../../../store/types";
import { loadTerminalAddons } from "./terminalAddons";
import {
  shouldClearTerminalOutputShortcut,
  shouldReleaseCommandWForTabCloseShortcut,
} from "./terminalKeyboardUtils";
import {
  formatTerminalCommandTitle,
  formatTerminalPathTitle,
} from "./terminalTitleUtils";
import { useTerminalSearchState } from "./useTerminalSearchState";
import { useTerminalSessionLifecycle } from "./useTerminalSessionLifecycle";
import { TerminalSearchPanel } from "./TerminalSearchPanel";
import { createTerminalWriteQueue } from "./terminalWriteQueue";
import type { TerminalWriteQueue } from "./terminalWriteQueue";

/** Resize debounce interval in milliseconds. */
const RESIZE_DEBOUNCE_MS = 50;

type TerminalViewProps = {
  tabId: string;
  focusRequestKey?: number;
};

/** Renders an xterm instance and binds it to a daemon-backed terminal session. */
export const TerminalView = memo(function TerminalView({ tabId, focusRequestKey = 0 }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const terminalWriteQueueRef = useRef<TerminalWriteQueue | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const outputSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const readIndexRef = useRef(0);
  const didRequestCloseRef = useRef(false);
  const lastAppliedTitleRef = useRef<string>("");
  const {
    renameTab,
    resizeTerminal,
    writeTerminalInput,
  } = useCommands();

  /** Returns true when the user has manually renamed this terminal tab. */
  const isUserRenamed = useCallback((): boolean => {
    const tab = tabStore
      .getState()
      .tabs.find(
        (candidate): candidate is Extract<WorkspaceTab, { kind: "terminal" }> =>
          candidate.id === tabId && candidate.kind === "terminal",
      );
    return tab?.data.userRenamed === true;
  }, [tabId]);

  /** Applies one readable command-derived title to this terminal tab. */
  const updateTerminalTabTitleFromCommand = useCallback(
    (command: string): void => {
      if (isUserRenamed()) {
        return;
      }
      const title = formatTerminalCommandTitle(command);
      if (!title || title === lastAppliedTitleRef.current) {
        return;
      }

      lastAppliedTitleRef.current = title;
      renameTab(tabId, title);
    },
    [renameTab, tabId, isUserRenamed],
  );

  /** Applies one readable current-directory title to this terminal tab. */
  const updateTerminalTabTitleFromPath = useCallback(
    (path: string | undefined): void => {
      if (isUserRenamed()) {
        return;
      }
      const title = formatTerminalPathTitle(path);
      if (!title || title === lastAppliedTitleRef.current) {
        return;
      }

      lastAppliedTitleRef.current = title;
      renameTab(tabId, title);
    },
    [renameTab, tabId, isUserRenamed],
  );

  const searchState = useTerminalSearchState({
    terminalHostRef: containerRef,
    searchInputRef,
    xtermRef,
    searchAddonRef,
    focusRequestKey,
  });
  const {
    isSearchOpen: isSearchPanelOpen,
    searchQuery: terminalSearchQuery,
    setSearchQuery: setTerminalSearchQuery,
    runTerminalSearch,
    closeSearchPanel,
  } = searchState;

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) {
      return;
    }
    let disposed = false;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
      fontFamily: '"MesloLGS NF", "JetBrains Mono", "SF Mono", Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      scrollback: 5_000,
      smoothScrollDuration: 125,
      scrollSensitivity: 1,
      fastScrollSensitivity: 5,
      rescaleOverlappingGlyphs: true,
      theme: {
        background: "#292e36",
        foreground: "#e7ebf0",
      },
    });
    terminal.open(host);
    const { fitAddon, searchAddon } = loadTerminalAddons(terminal);
    safeFitTerminalToHost(terminal, fitAddon);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;
    terminalWriteQueueRef.current = createTerminalWriteQueue(terminal);

    terminal.attachCustomKeyEventHandler((event) => {
      if (shouldReleaseCommandWForTabCloseShortcut(event)) {
        return false;
      }

      if (shouldClearTerminalOutputShortcut(event)) {
        if (event.type === "keydown") {
          terminal.clear();
        }
        return false;
      }

      if (!(event.shiftKey && event.key === "Enter")) {
        return true;
      }

      if (event.type !== "keydown") {
        return false;
      }

      if (!sessionIdRef.current) {
        return false;
      }

      terminal.paste("\n");
      return false;
    });

    const titleDisposable = terminal.onTitleChange((title) => {
      updateTerminalTabTitleFromCommand(title);
    });

    const writeDisposable = terminal.onData((data) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) {
        return;
      }

      // Send input to PTY immediately — this is the latency-critical path.
      void writeTerminalInput({ sessionId, data }).catch((error) => {
        reportTerminalAsyncError("write terminal input", error);
      });
    });

    let resizeTimerId: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (disposed) {
        return;
      }

      if (resizeTimerId !== null) {
        clearTimeout(resizeTimerId);
      }
      resizeTimerId = setTimeout(() => {
        resizeTimerId = null;
        if (disposed) {
          return;
        }

        safeFitTerminalToHost(terminal, fitAddon);
        const sessionId = sessionIdRef.current;
        if (!sessionId) {
          return;
        }

        void resizeTerminal({ sessionId, cols: terminal.cols, rows: terminal.rows }).catch((error) => {
          reportTerminalAsyncError("resize terminal", error);
        });
      }, RESIZE_DEBOUNCE_MS);
    });
    // Observe the terminal host element directly — this is the element xterm
    // renders into and is the correct measurement target for FitAddon.
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      titleDisposable.dispose();
      writeDisposable.dispose();
      outputSubscriptionRef.current?.unsubscribe();
      outputSubscriptionRef.current = null;
      if (resizeTimerId !== null) {
        clearTimeout(resizeTimerId);
      }
      resizeObserver.disconnect();
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      terminalWriteQueueRef.current?.dispose();
      terminalWriteQueueRef.current = null;
    };
  }, [resizeTerminal, updateTerminalTabTitleFromCommand, writeTerminalInput]);

  useTerminalSessionLifecycle({
    tabId,
    xtermRef,
    fitAddonRef,
    sessionIdRef,
    outputSubscriptionRef,
    readIndexRef,
    didRequestCloseRef,
    terminalWriteQueueRef,
    updateTerminalTabTitleFromCommand,
    updateTerminalTabTitleFromPath,
    isTerminalAttached,
    reportTerminalAsyncError,
  });

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        minHeight: 0,
        p: 1.5,
        bgcolor: "#2b3038",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {isSearchPanelOpen ? (
        <TerminalSearchPanel
          searchInputRef={searchInputRef}
          searchQuery={terminalSearchQuery}
          onSearchQueryChange={setTerminalSearchQuery}
          onSearchPrevious={() => {
            runTerminalSearch("previous");
          }}
          onSearchNext={() => {
            runTerminalSearch("next");
          }}
          onClose={closeSearchPanel}
        />
       ) : null}
      <Box
        ref={terminalHostRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          "& .xterm-viewport": {
            overflowY: "hidden",
          },
        }}
      />
    </Box>
  );
});

/** Reports one terminal async error without breaking render lifecycle. */
function reportTerminalAsyncError(action: string, error: unknown): void {
  console.error(`[TerminalView] Failed to ${action}`, error);
}

/** Fits one attached xterm instance to its host without throwing during teardown races. */
function safeFitTerminalToHost(terminal: Terminal, fitAddon: FitAddon): void {
  if (!isTerminalAttached(terminal)) {
    return;
  }

  try {
    fitAddon.fit();
  } catch (error) {
    reportTerminalAsyncError("fit terminal", error);
  }
}

/** Returns true when one xterm instance is still attached to one DOM element. */
function isTerminalAttached(terminal: Terminal): boolean {
  if (!("element" in terminal)) {
    return true;
  }

  return Boolean(terminal.element);
}
