import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type WorkspaceRightPaneTab = "files" | "changes" | "pr";

type WorkspacePaneStoreState = {
  rightPaneTab: WorkspaceRightPaneTab;
  fileSearchRequestKey: number;
  setRightPaneTab: (tab: WorkspaceRightPaneTab) => void;
  requestFileSearch: () => void;
};

/** Stores workspace pane UI state shared between shortcuts, commands, and pane views. */
export const workspacePaneStore = create<WorkspacePaneStoreState>()(
  immer((set) => ({
    rightPaneTab: "files",
    fileSearchRequestKey: 0,
    setRightPaneTab: (rightPaneTab) => {
      set({ rightPaneTab });
    },
    requestFileSearch: () => {
      set((state) => {
        state.fileSearchRequestKey += 1;
      });
    },
  })),
);
