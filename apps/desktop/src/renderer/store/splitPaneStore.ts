import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  addTabToPane,
  collectLeaves,
  createLeaf,
  createPaneId,
  findLeaf,
  findLeafByTabId,
  moveTabToPane,
  removeTabFromPane,
  reorderTabInPane,
  selectTabInPane,
  setActivePaneState,
  setSplitRatio,
  splitPaneWithTab,
  type PaneLeaf,
  type SplitDirection,
  type SplitPaneNode,
} from "./split-pane-domain";

const ROOT_PANE_ID = "root-pane";

export type SplitPaneStoreState = {
  root: SplitPaneNode;
  activePaneId: string;

  // Queries
  getActivePane: () => PaneLeaf | null;
  getPane: (paneId: string) => PaneLeaf | null;
  getPaneForTab: (tabId: string) => PaneLeaf | null;
  getAllPanes: () => PaneLeaf[];

  // Mutations
  setActivePane: (paneId: string) => void;
  selectTab: (paneId: string, tabId: string) => void;
  addTab: (tabId: string, paneId?: string) => void;
  removeTab: (tabId: string) => void;
  splitPane: (input: {
    tabId: string;
    targetPaneId: string;
    direction: SplitDirection;
    placement: "first" | "second";
  }) => void;
  moveTab: (tabId: string, targetPaneId: string) => void;
  reorderTab: (paneId: string, draggedTabId: string, targetTabId: string, position: "before" | "after") => void;
  updateSplitRatio: (branchId: string, ratio: number) => void;
  /** Resets the layout to a single pane with the given tabs. */
  resetLayout: (tabIds: string[], selectedTabId?: string) => void;
};

/** Stores the recursive split-pane layout tree for the editor area. */
export const splitPaneStore = create<SplitPaneStoreState>()(
  immer((set, get) => ({
    root: createLeaf(ROOT_PANE_ID, [], ""),
    activePaneId: ROOT_PANE_ID,

    getActivePane: () => {
      const state = get();
      return findLeaf(state.root, state.activePaneId);
    },

    getPane: (paneId) => {
      return findLeaf(get().root, paneId);
    },

    getPaneForTab: (tabId) => {
      return findLeafByTabId(get().root, tabId);
    },

    getAllPanes: () => {
      return collectLeaves(get().root);
    },

    setActivePane: (paneId) => {
      set((state) => {
        const next = setActivePaneState(state, paneId);
        if (next) {
          state.activePaneId = next.activePaneId;
        }
      });
    },

    selectTab: (paneId, tabId) => {
      set((state) => {
        const next = selectTabInPane(state, paneId, tabId);
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    addTab: (tabId, paneId) => {
      set((state) => {
        const next = addTabToPane(state, tabId, paneId);
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    removeTab: (tabId) => {
      set((state) => {
        const next = removeTabFromPane(state, tabId);
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    splitPane: (input) => {
      set((state) => {
        const next = splitPaneWithTab(state, {
          ...input,
          newPaneId: createPaneId(),
          newBranchId: createPaneId(),
        });
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    moveTab: (tabId, targetPaneId) => {
      set((state) => {
        const next = moveTabToPane(state, { tabId, targetPaneId });
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    reorderTab: (paneId, draggedTabId, targetTabId, position) => {
      set((state) => {
        const next = reorderTabInPane(state, paneId, draggedTabId, targetTabId, position);
        if (next) {
          state.root = next.root;
          state.activePaneId = next.activePaneId;
        }
      });
    },

    updateSplitRatio: (branchId, ratio) => {
      set((state) => {
        const next = setSplitRatio(state, branchId, ratio);
        if (next) {
          state.root = next.root;
        }
      });
    },

    resetLayout: (tabIds, selectedTabId) => {
      set({
        root: createLeaf(ROOT_PANE_ID, tabIds, selectedTabId ?? tabIds[0] ?? ""),
        activePaneId: ROOT_PANE_ID,
      });
    },
  })),
);
