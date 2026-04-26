import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type WorkspaceFileTreeStoreState = {
  selectedEntryPath: string;
  deleteSelectionRequestId: number;
  undoRequestId: number;
  setSelectedEntryPath: (path: string) => void;
  requestDeleteSelection: () => void;
  requestUndo: () => void;
};

/** Stores file-tree selection and command-driven delete/undo request signals. */
export const workspaceFileTreeStore = create<WorkspaceFileTreeStoreState>()(
  immer((set) => ({
    selectedEntryPath: "",
    deleteSelectionRequestId: 0,
    undoRequestId: 0,
    setSelectedEntryPath: (selectedEntryPath) => {
      set({ selectedEntryPath });
    },
    requestDeleteSelection: () => {
      set((state) => {
        state.deleteSelectionRequestId += 1;
      });
    },
    requestUndo: () => {
      set((state) => {
        state.undoRequestId += 1;
      });
    },
  })),
);
