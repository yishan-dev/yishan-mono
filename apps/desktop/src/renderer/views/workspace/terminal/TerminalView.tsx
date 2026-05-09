import { Box, IconButton, InputBase, Stack } from "@mui/material";
import type { FitAddon } from "@xterm/addon-fit";
import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useCommands } from "../../../hooks/useCommands";
import { tabStore } from "../../../store/tabStore";
import type { WorkspaceTab } from "../../../store/types";
import { loadTerminalAddons } from "./terminalAddons";
import {
  isShiftEnterLineFeedChord,
  shouldClearTerminalOutputShortcut,
  shouldReleaseCommandWForTabCloseShortcut,
} from "./terminalKeyboardUtils";
import { TerminalSessionOrchestrator } from "./terminalSessionOrchestrator";
import {
  formatTerminalCommandTitle,
  formatTerminalPathTitle,
  resolveTerminalWorkspacePath,
} from "./terminalTitleUtils";
import { createTerminalWriteQueue } from "./terminalWriteQueue";
import type { TerminalWriteQueue } from "./terminalWriteQueue";

/** Resize debounce interval in milliseconds. */
const RESIZE_DEBOUNCE_MS = 50;

type TerminalViewProps = {
  tabId: string;
  focusRequestKey?: number;
};

const TERMINAL_SEARCH_OPTIONS: ISearchOptions = {
  caseSensitive: false,
  regex: false,
  wholeWord: false,
  incremental: true,
};

/** Renders an xterm instance and binds it to a daemon-backed terminal session. */
export const TerminalView = memo(function TerminalView({ tabId, focusRequestKey = 0 }: TerminalViewProps) {
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    closeTab,
    createTerminalSession,
    listTerminalSessions,
    readTerminalOutput,
    renameTab,
    resizeTerminal,
    subscribeTerminalOutput,
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

  /** Clears current search decorations in the active terminal session. */
  const clearTerminalSearchHighlights = useCallback((): void => {
    const searchAddon = searchAddonRef.current;
    if (!searchAddon) {
      return;
    }

    const searchAddonWithClear = searchAddon as unknown as {
      clearDecorations?: () => void;
      clearActiveDecoration?: () => void;
    };
    searchAddonWithClear.clearDecorations?.();
    searchAddonWithClear.clearActiveDecoration?.();
  }, []);

  /** Runs one terminal-buffer search in the requested direction. */
  const runTerminalSearch = useCallback(
    (direction: "next" | "previous"): void => {
      const searchAddon = searchAddonRef.current;
      const query = searchQuery.trim();
      if (!searchAddon || query.length === 0) {
        return;
      }

      if (direction === "next") {
        searchAddon.findNext(query, TERMINAL_SEARCH_OPTIONS);
        return;
      }

      searchAddon.findPrevious(query, TERMINAL_SEARCH_OPTIONS);
    },
    [searchQuery],
  );

  /** Closes the search UI and clears all in-terminal search highlights. */
  const closeSearchPanel = useCallback((): void => {
    setIsSearchOpen(false);
    setSearchQuery("");
    clearTerminalSearchHighlights();
    xtermRef.current?.focus();
  }, [clearTerminalSearchHighlights]);

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

      if (!isShiftEnterLineFeedChord(event)) {
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

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (!isSearchOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeSearchPanel();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        runTerminalSearch(event.shiftKey ? "previous" : "next");
      }
    };

    host.addEventListener("keydown", onKeyDown);
    return () => {
      host.removeEventListener("keydown", onKeyDown);
    };
  }, [closeSearchPanel, isSearchOpen, runTerminalSearch]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (focusRequestKey <= 0 || isSearchOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      xtermRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusRequestKey, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const query = searchQuery.trim();
    if (query.length === 0) {
      clearTerminalSearchHighlights();
      return;
    }

    searchAddonRef.current?.findNext(query, TERMINAL_SEARCH_OPTIONS);
  }, [clearTerminalSearchHighlights, isSearchOpen, searchQuery]);

  useEffect(() => {
    const terminal = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) {
      return;
    }
    let cancelled = false;
    const sessionOrchestrator = new TerminalSessionOrchestrator({
      createTerminalSession,
      listTerminalSessions,
      readTerminalOutput,
      resizeTerminal,
      writeTerminalInput,
    });

    const attachSession = async () => {
      const restored = await sessionOrchestrator.attachOrCreateAndRestore({
        tabId,
        terminal,
        fitAddon,
      });
      if (!restored) {
        return;
      }
      if (cancelled) {
        return;
      }

      sessionIdRef.current = restored.sessionId;
      readIndexRef.current = restored.nextIndex;
      didRequestCloseRef.current = false;
      const terminalTab = tabStore
        .getState()
        .tabs.find(
          (candidate): candidate is Extract<WorkspaceTab, { kind: "terminal" }> =>
            candidate.id === tabId && candidate.kind === "terminal",
        );
      const launchCommand = terminalTab?.data.launchCommand;
      if (launchCommand) {
        updateTerminalTabTitleFromCommand(launchCommand);
      } else {
        updateTerminalTabTitleFromPath(resolveTerminalWorkspacePath(terminalTab));
      }

      outputSubscriptionRef.current?.unsubscribe();
      outputSubscriptionRef.current = await subscribeTerminalOutput({
        sessionId: restored.sessionId,
        onData: (payload) => {
          if (payload.sessionId !== sessionIdRef.current) {
            return;
          }

          if (payload.type === "output") {
            if (payload.nextIndex <= readIndexRef.current) {
              return;
            }

            readIndexRef.current = payload.nextIndex;
            const { chunk } = payload;
            if (!isTerminalAttached(terminal)) {
              return;
            }
            if (chunk instanceof Uint8Array) {
              // Binary fast-path: pass raw bytes directly to xterm.
              if (chunk.byteLength > 0) {
                terminalWriteQueueRef.current?.enqueue(chunk);
              }
            } else if (typeof chunk === "string" && chunk.length > 0) {
              // JSON-RPC fallback: string data.
              terminalWriteQueueRef.current?.enqueue(chunk);
            }
            return;
          }

          if (didRequestCloseRef.current) {
            return;
          }
          didRequestCloseRef.current = true;
          closeTab(tabId);
        },
        onError: (error) => {
          reportTerminalAsyncError("subscribe terminal output", error);
        },
      });

      if (cancelled) {
        outputSubscriptionRef.current?.unsubscribe();
        outputSubscriptionRef.current = null;
        return;
      }

      if (restored.exited && !didRequestCloseRef.current) {
        didRequestCloseRef.current = true;
        closeTab(tabId);
      }
    };

    void attachSession().catch((error) => {
      reportTerminalAsyncError("attach terminal session", error);
    });

    return () => {
      cancelled = true;
    };
  }, [
    closeTab,
    createTerminalSession,
    listTerminalSessions,
    readTerminalOutput,
    resizeTerminal,
    subscribeTerminalOutput,
    tabId,
    updateTerminalTabTitleFromCommand,
    updateTerminalTabTitleFromPath,
    writeTerminalInput,
  ]);

  return (
    <Box
      ref={terminalHostRef}
      sx={{
        flex: 1,
        minHeight: 0,
        p: 1.5,
        bgcolor: "#2b3038",
        height: "100%",
        "& .xterm-viewport": {
          overflowY: "hidden",
        },
      }}
    >
      {isSearchOpen ? (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            top: 8,
            right: 12,
            alignItems: "center",
            px: 1,
            py: 0.5,
            border: "1px solid #414754",
            borderRadius: 1,
            bgcolor: "#31363f",
            zIndex: 2,
          }}
        >
          <InputBase
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Find"
            slotProps={{
              input: {
                "aria-label": "Search terminal output",
              },
            }}
            sx={{
              width: 220,
              px: 0.75,
              py: 0.25,
              border: "1px solid #414754",
              borderRadius: 0.75,
              color: "#e7ebf0",
              fontSize: 13,
            }}
          />
          <IconButton
            aria-label="Previous terminal match"
            size="small"
            disabled={searchQuery.trim().length === 0}
            onClick={() => {
              runTerminalSearch("previous");
            }}
            sx={{
              color: "#e7ebf0",
              fontSize: 11,
              "&.Mui-disabled": {
                color: "#8b8b8b",
              },
            }}
          >
            Prev
          </IconButton>
          <IconButton
            aria-label="Next terminal match"
            size="small"
            disabled={searchQuery.trim().length === 0}
            onClick={() => {
              runTerminalSearch("next");
            }}
            sx={{
              color: "#e7ebf0",
              fontSize: 11,
              "&.Mui-disabled": {
                color: "#8b8b8b",
              },
            }}
          >
            Next
          </IconButton>
          <IconButton
            aria-label="Close terminal search"
            size="small"
            onClick={closeSearchPanel}
            sx={{ color: "#e7ebf0", fontSize: 11 }}
          >
            Close
          </IconButton>
         </Stack>
      ) : null}
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
