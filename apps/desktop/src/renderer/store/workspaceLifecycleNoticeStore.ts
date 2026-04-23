import { create } from "zustand";

export type WorkspaceLifecycleScriptWarning = {
  scriptKind: "setup" | "post";
  timedOut: boolean;
  message: string;
  command: string;
  stdoutExcerpt: string;
  stderrExcerpt: string;
  exitCode: number | null;
  signal: string | null;
  logFilePath: string | null;
};

export type WorkspaceLifecycleNotice = {
  id: string;
  workspaceName: string;
  warning: WorkspaceLifecycleScriptWarning;
};

type WorkspaceLifecycleNoticeStoreState = {
  queue: WorkspaceLifecycleNotice[];
  detailNotice: WorkspaceLifecycleNotice | null;
  enqueueWarnings: (workspaceName: string, warnings: WorkspaceLifecycleScriptWarning[]) => void;
  dismissActiveNotice: () => void;
  openActiveNoticeDetails: () => void;
  closeDetailNotice: () => void;
};

function createNoticeId(scriptKind: "setup" | "post"): string {
  return `${scriptKind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Stores workspace lifecycle warning queue and selected detail modal payload. */
export const workspaceLifecycleNoticeStore = create<WorkspaceLifecycleNoticeStoreState>((set) => ({
  queue: [],
  detailNotice: null,
  enqueueWarnings: (workspaceName, warnings) => {
    const normalizedWorkspaceName = workspaceName.trim() || "Workspace";
    const notices = warnings.map((warning) => ({
      id: createNoticeId(warning.scriptKind),
      workspaceName: normalizedWorkspaceName,
      warning,
    }));
    if (notices.length === 0) {
      return;
    }

    set((state) => ({
      queue: [...state.queue, ...notices],
    }));
  },
  dismissActiveNotice: () => {
    set((state) => ({
      queue: state.queue.slice(1),
    }));
  },
  openActiveNoticeDetails: () => {
    set((state) => {
      const activeNotice = state.queue[0] ?? null;
      if (!activeNotice) {
        return state;
      }

      return {
        queue: state.queue.slice(1),
        detailNotice: activeNotice,
      };
    });
  },
  closeDetailNotice: () => {
    set({ detailNotice: null });
  },
}));

/** Enqueues lifecycle warnings for workspace create/close in-app notifications. */
export function enqueueWorkspaceLifecycleWarnings(input: {
  workspaceName: string;
  warnings: WorkspaceLifecycleScriptWarning[];
}): void {
  workspaceLifecycleNoticeStore.getState().enqueueWarnings(input.workspaceName, input.warnings);
}
