import type { RpcFrontendMessagePayload } from "../../shared/contracts/rpcSchema";
import { dispatchNotification, playNotificationSound } from "../commands/notificationCommands";
import { type WorkspaceAgentStatus, type WorkspaceUnreadTone, chatStore } from "../store/chatStore";
import { workspaceStore } from "../store/workspaceStore";
import { subscribeBackendEvent } from "./backendEventPipeline";
import { subscribeInAppNotificationEvent } from "./backendEventSubscriptions";

type NotificationEventPayload = RpcFrontendMessagePayload<"notificationEvent">;
type ObserverStatusPayload = NonNullable<NotificationEventPayload["observerStatus"]>;
type NotificationSoundPayload = NonNullable<NotificationEventPayload["soundToPlay"]>;
type AgentSessionLifecycleStatus = "running" | "waiting_input";

type BackendEventStoreBindingsDependencies = {
  subscribeGitChanged: (listener: (workspaceWorktreePath: string) => void) => () => void;
  subscribeWorkspaceFilesChanged: (
    listener: (workspaceWorktreePath: string, changedRelativePaths?: string[]) => void,
  ) => () => void;
  subscribeInAppNotification: (listener: (payload: NotificationEventPayload) => void) => () => void;
  incrementFileTreeRefreshVersion: (workspaceWorktreePath?: string, changedRelativePaths?: string[]) => void;
  incrementGitRefreshVersion: (workspaceWorktreePath: string) => void;
  setWorkspaceAgentStatusByWorkspaceId: (statusByWorkspaceId: Record<string, WorkspaceAgentStatus>) => void;
  recordWorkspaceUnreadNotification: (workspaceId: string, tone: WorkspaceUnreadTone) => void;
  dispatchSystemNotification: (input: { title: string; body?: string }) => Promise<void>;
  playNotificationSound: (input: NotificationSoundPayload) => Promise<void>;
};

const DEFAULT_BACKEND_EVENT_STORE_BINDINGS_DEPENDENCIES: BackendEventStoreBindingsDependencies = {
  subscribeGitChanged: (listener) =>
    subscribeBackendEvent("git.changed", (event) => {
      if (event.source !== "gitChanged") {
        return;
      }

      listener(event.payload.workspaceWorktreePath);
    }),
  subscribeWorkspaceFilesChanged: (listener) =>
    subscribeBackendEvent("workspace.files.changed", (event) => {
      if (event.source !== "workspaceFilesChanged") {
        return;
      }

      listener(event.payload.workspaceWorktreePath, event.payload.changedRelativePaths);
    }),
  subscribeInAppNotification: (listener) => {
    return subscribeInAppNotificationEvent(listener);
  },
  incrementFileTreeRefreshVersion: (workspaceWorktreePath, changedRelativePaths) => {
    workspaceStore.getState().incrementFileTreeRefreshVersion(workspaceWorktreePath, changedRelativePaths);
  },
  incrementGitRefreshVersion: (workspaceWorktreePath) => {
    workspaceStore.getState().incrementGitRefreshVersion(workspaceWorktreePath);
  },
  setWorkspaceAgentStatusByWorkspaceId: (statusByWorkspaceId) => {
    chatStore.getState().setWorkspaceAgentStatusByWorkspaceId(statusByWorkspaceId);
  },
  recordWorkspaceUnreadNotification: (workspaceId, tone) => {
    chatStore.getState().recordWorkspaceUnreadNotification(workspaceId, tone);
  },
  dispatchSystemNotification: async (input) => {
    await dispatchNotification(input);
  },
  playNotificationSound: async (input) => {
    await playNotificationSound(input);
  },
};

/**
 * Resolves one observer lifecycle status from notification observer metadata.
 */
function resolveLifecycleStatus(
  eventType: ObserverStatusPayload["normalizedEventType"],
): AgentSessionLifecycleStatus | null {
  if (eventType === "start") {
    return "running";
  }

  if (eventType === "wait_input") {
    return "waiting_input";
  }

  if (eventType === "stop") {
    return null;
  }

  return null;
}

/**
 * Aggregates session-level lifecycle states into one workspace-level status map.
 *
 * Priority per workspace is: `running` > `waiting_input` > absent (`idle`).
 */
function deriveWorkspaceAgentStatusByWorkspaceId(
  lifecycleBySessionKey: Map<
    string,
    {
      workspaceId: string;
      status: AgentSessionLifecycleStatus;
    }
  >,
): Record<string, WorkspaceAgentStatus> {
  const statusByWorkspaceId: Record<string, WorkspaceAgentStatus> = {};

  for (const lifecycle of lifecycleBySessionKey.values()) {
    const previousStatus = statusByWorkspaceId[lifecycle.workspaceId];
    if (lifecycle.status === "running") {
      statusByWorkspaceId[lifecycle.workspaceId] = "running";
      continue;
    }

    if (previousStatus !== "running") {
      statusByWorkspaceId[lifecycle.workspaceId] = "waiting_input";
    }
  }

  return statusByWorkspaceId;
}

/**
 * Creates one binding function that connects normalized backend events to workspace store actions.
 */
export function createBackendEventStoreBindings(
  dependencies: BackendEventStoreBindingsDependencies = DEFAULT_BACKEND_EVENT_STORE_BINDINGS_DEPENDENCIES,
) {
  /**
   * Starts backend event listeners that mutate renderer store state and returns one teardown function.
   */
  return function startBackendEventStoreBindings() {
    const lifecycleBySessionKey = new Map<
      string,
      {
        workspaceId: string;
        status: AgentSessionLifecycleStatus;
      }
    >();

    const unsubscribeGitChanged = dependencies.subscribeGitChanged((workspaceWorktreePath) => {
      dependencies.incrementGitRefreshVersion(workspaceWorktreePath);
    });
    const unsubscribeWorkspaceFilesChanged = dependencies.subscribeWorkspaceFilesChanged(
      (workspaceWorktreePath, changedRelativePaths) => {
        dependencies.incrementFileTreeRefreshVersion(workspaceWorktreePath, changedRelativePaths);
        dependencies.incrementGitRefreshVersion(workspaceWorktreePath);
      },
    );
    const unsubscribeInAppNotification = dependencies.subscribeInAppNotification((payload) => {
      const workspaceId = payload.workspaceId?.trim();

      const observerStatus = payload.observerStatus;
      if (observerStatus && workspaceId) {
        const sessionKey = observerStatus.sessionKey.trim();
        if (sessionKey.length > 0) {
          const nextStatus = resolveLifecycleStatus(observerStatus.normalizedEventType);

          if (nextStatus === null) {
            lifecycleBySessionKey.delete(sessionKey);
          } else {
            lifecycleBySessionKey.set(sessionKey, {
              workspaceId,
              status: nextStatus,
            });
          }

          dependencies.setWorkspaceAgentStatusByWorkspaceId(
            deriveWorkspaceAgentStatusByWorkspaceId(lifecycleBySessionKey),
          );
        }
      }

      if (payload.showSystemNotification) {
        void dependencies
          .dispatchSystemNotification({
            title: payload.title,
            body: payload.body,
          })
          .catch(() => {
            // Notification delivery failures should not block store state updates.
          });
      }

      if (payload.soundToPlay) {
        void dependencies.playNotificationSound(payload.soundToPlay).catch(() => {
          // Sound playback failures should not block store state updates.
        });
      }

      if (payload.silent === true || !workspaceId) {
        return;
      }

      const tone: WorkspaceUnreadTone = payload.tone === "error" ? "error" : "success";
      dependencies.recordWorkspaceUnreadNotification(workspaceId, tone);
    });

    return () => {
      unsubscribeGitChanged();
      unsubscribeWorkspaceFilesChanged();
      unsubscribeInAppNotification();
      lifecycleBySessionKey.clear();
    };
  };
}

/**
 * Starts shared bindings from normalized backend events into renderer stores.
 */
export const startBackendEventStoreBindings = createBackendEventStoreBindings();
