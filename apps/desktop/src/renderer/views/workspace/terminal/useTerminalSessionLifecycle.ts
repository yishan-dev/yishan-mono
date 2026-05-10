import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import type { MutableRefObject } from "react";
import { useEffect } from "react";
import { useCommands } from "../../../hooks/useCommands";
import { tabStore } from "../../../store/tabStore";
import type { WorkspaceTab } from "../../../store/types";
import { TerminalSessionOrchestrator } from "./terminalSessionOrchestrator";
import { resolveTerminalWorkspacePath } from "./terminalTitleUtils";
import type { TerminalWriteQueue } from "./terminalWriteQueue";

type UseTerminalSessionLifecycleInput = {
  tabId: string;
  xtermRef: MutableRefObject<Terminal | null>;
  fitAddonRef: MutableRefObject<FitAddon | null>;
  sessionIdRef: MutableRefObject<string | null>;
  outputSubscriptionRef: MutableRefObject<{ unsubscribe: () => void } | null>;
  readIndexRef: MutableRefObject<number>;
  didRequestCloseRef: MutableRefObject<boolean>;
  terminalWriteQueueRef: MutableRefObject<TerminalWriteQueue | null>;
  updateTerminalTabTitleFromCommand: (command: string) => void;
  updateTerminalTabTitleFromPath: (path: string | undefined) => void;
  isTerminalAttached: (terminal: Terminal) => boolean;
  reportTerminalAsyncError: (action: string, error: unknown) => void;
};

export function useTerminalSessionLifecycle({
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
}: UseTerminalSessionLifecycleInput) {
  const {
    closeTab,
    createTerminalSession,
    listTerminalSessions,
    readTerminalOutput,
    resizeTerminal,
    subscribeTerminalOutput,
    writeTerminalInput,
  } = useCommands();

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
      const restored = await sessionOrchestrator.attachOrCreateAndRestore({ tabId, terminal, fitAddon });
      if (!restored || cancelled) {
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
              if (chunk.byteLength > 0) {
                terminalWriteQueueRef.current?.enqueue(chunk);
              }
            } else if (typeof chunk === "string" && chunk.length > 0) {
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
    didRequestCloseRef,
    fitAddonRef,
    isTerminalAttached,
    listTerminalSessions,
    outputSubscriptionRef,
    readIndexRef,
    readTerminalOutput,
    reportTerminalAsyncError,
    resizeTerminal,
    sessionIdRef,
    subscribeTerminalOutput,
    tabId,
    terminalWriteQueueRef,
    updateTerminalTabTitleFromCommand,
    updateTerminalTabTitleFromPath,
    writeTerminalInput,
    xtermRef,
  ]);
}
