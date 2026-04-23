import type { OpenWorkspaceTabInput, WorkspaceTab } from "../types";
import type { WorkspaceTabStateSlice } from "./types";

/** Returns a tab in the target workspace that matches the open request identity. */
export function findExistingTab(
  tabs: WorkspaceTab[],
  input: OpenWorkspaceTabInput,
  targetWorkspaceId: string,
): WorkspaceTab | undefined {
  if (input.kind === "diff") {
    return tabs.find(
      (tab) => tab.workspaceId === targetWorkspaceId && tab.kind === "diff" && tab.data.path === input.path,
    );
  }

  if (input.kind === "file") {
    return tabs.find(
      (tab) => tab.workspaceId === targetWorkspaceId && tab.kind === "file" && tab.data.path === input.path,
    );
  }

  if (input.reuseExisting === false) {
    return undefined;
  }

  return tabs.find(
    (tab) =>
      tab.workspaceId === targetWorkspaceId &&
      tab.kind === "terminal" &&
      tab.title === (input.title?.trim() || "Terminal"),
  );
}

/** Returns an empty state patch for tab-close metadata cleanup handled by chat store. */
export function removeTabMetadataById(_state: WorkspaceTabStateSlice, _removedTabIds: string[]): Record<string, never> {
  return {};
}
