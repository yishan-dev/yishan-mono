import { useEffect, useRef } from "react";
import type { DiffTabSource } from "../store/types";

export type RefreshableOpenTab =
  | {
      id: string;
      kind: "file";
      path: string;
      isDirty: boolean;
      isUnsupported?: boolean;
    }
  | {
      id: string;
      kind: "diff";
      path: string;
      source?: DiffTabSource;
    };

type OpenTabAutoRefreshCommands = {
  readFile: (input: { workspaceWorktreePath: string; relativePath: string }) => Promise<{ content: string }>;
  readDiff: (input: { workspaceWorktreePath: string; relativePath: string }) => Promise<{ oldContent: string; newContent: string }>;
  readCommitDiff: (input: {
    workspaceWorktreePath: string;
    commitHash: string;
    relativePath: string;
  }) => Promise<{ oldContent: string; newContent: string }>;
  readBranchComparisonDiff: (input: {
    workspaceWorktreePath: string;
    targetBranch: string;
    relativePath: string;
  }) => Promise<{ oldContent: string; newContent: string }>;
  refreshFileTabFromDisk: (input: { tabId: string; content: string; deleted: boolean }) => void;
  refreshDiffTabContent: (input: { tabId: string; oldContent: string; newContent: string }) => void;
};

type UseOpenTabAutoRefreshInput = {
  workspaceWorktreePath?: string;
  tabs: RefreshableOpenTab[];
  commands: OpenTabAutoRefreshCommands;
};

const POLL_INTERVAL_MS = 700;
const REFRESH_DEBOUNCE_MS = 220;

function isFileNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no such file") ||
    normalized.includes("not exist") ||
    normalized.includes("enoent") ||
    normalized.includes("not a directory") ||
    normalized.includes("notdir")
  );
}

/** Keeps open file and diff tabs synced with on-disk changes using debounced polling refresh. */
export function useOpenTabAutoRefresh(input: UseOpenTabAutoRefreshInput) {
  const { workspaceWorktreePath, commands } = input;
  const tabsRef = useRef(input.tabs);
  tabsRef.current = input.tabs;

  useEffect(() => {
    if (!workspaceWorktreePath || tabsRef.current.length === 0) {
      return;
    }

    let disposed = false;
    let inFlight = false;
    let queued = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const runRefresh = async () => {
      if (disposed || inFlight) {
        queued = true;
        return;
      }

      inFlight = true;
      const tabs = tabsRef.current;

      try {
        await Promise.all(
          tabs.map(async (tab) => {
            if (tab.kind === "file") {
              if (tab.isUnsupported) {
                return;
              }

              if (tab.isDirty) {
                return;
              }

              try {
                const response = await commands.readFile({
                  workspaceWorktreePath,
                  relativePath: tab.path,
                });
                commands.refreshFileTabFromDisk({
                  tabId: tab.id,
                  content: response.content,
                  deleted: false,
                });
              } catch (error) {
                if (!isFileNotFoundError(error)) {
                  return;
                }

                commands.refreshFileTabFromDisk({
                  tabId: tab.id,
                  content: "",
                  deleted: true,
                });
              }
              return;
            }

            try {
              const response =
                tab.source?.kind === "commit"
                  ? await commands.readCommitDiff({
                      workspaceWorktreePath,
                      commitHash: tab.source.commitHash,
                      relativePath: tab.path,
                    })
                  : tab.source?.kind === "branch"
                    ? await commands.readBranchComparisonDiff({
                        workspaceWorktreePath,
                        targetBranch: tab.source.targetBranch,
                        relativePath: tab.path,
                      })
                    : await commands.readDiff({
                        workspaceWorktreePath,
                        relativePath: tab.path,
                      });

              commands.refreshDiffTabContent({
                tabId: tab.id,
                oldContent: response.oldContent,
                newContent: response.newContent,
              });
            } catch {
              return;
            }
          }),
        );
      } finally {
        inFlight = false;
        if (queued) {
          queued = false;
          void runRefresh();
        }
      }
    };

    const scheduleRefresh = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void runRefresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    scheduleRefresh();
    const pollTimer = setInterval(() => {
      scheduleRefresh();
    }, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(pollTimer);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [commands, workspaceWorktreePath, input.tabs]);
}
