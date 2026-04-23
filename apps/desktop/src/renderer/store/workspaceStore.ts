import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createWorkspaceStoreActions } from "./actions";
import { initialWorkspaceState, partializeWorkspaceState } from "./state";
import type { WorkspaceStoreState } from "./types";

export type {
  AvailableCommand,
  AvailableModel,
  ChatMessage,
  OpenWorkspaceTabInput,
  WorkspaceStoreState,
  WorkspaceTab,
} from "./types";

export const workspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set, get) => ({
      projects: initialWorkspaceState.projects,
      repos: initialWorkspaceState.repos,
      workspaces: initialWorkspaceState.workspaces,
      gitChangesCountByWorkspaceId: {},
      gitChangeTotalsByWorkspaceId: {},
      gitRefreshVersionByWorktreePath: {},
      fileTreeChangedRelativePathsByWorktreePath: {},
      selectedProjectId: initialWorkspaceState.selectedProjectId,
      selectedRepoId: initialWorkspaceState.selectedRepoId,
      selectedWorkspaceId: initialWorkspaceState.selectedWorkspaceId,
      displayProjectIds: [],
      displayRepoIds: [],
      lastUsedExternalAppId: undefined,
      fileTreeRefreshVersion: 0,
      ...createWorkspaceStoreActions(set, get),
    }),
    {
      name: "yishan-workspace-store",
      storage: createJSONStorage(() => localStorage),
      partialize: partializeWorkspaceState,
    },
  ),
);
