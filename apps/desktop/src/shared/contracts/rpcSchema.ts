import type { NotificationEventType } from "../notifications/notificationPreferences";
import type { AppActionPayload } from "./actions";

export type RpcSchema = {
  toFrontend: {
    messages: {
      appAction: AppActionPayload;
      chatEvent: {
        workspaceId: string;
        sessionId: string;
        event: {
          type: string;
          text?: string;
          message?: string;
          code?: string;
          exitCode?: number;
          [key: string]: unknown;
        };
      };
      notificationEvent: {
        id: string;
        title: string;
        body?: string;
        tone: "success" | "error";
        createdAt: string;
        agent?: string;
        workspaceId?: string;
        workspaceName?: string;
        sessionId?: string;
        navigationPath?: string;
        notificationEventType?: NotificationEventType;
        silent?: boolean;
        showSystemNotification?: boolean;
        soundToPlay?: {
          soundId: "chime" | "ping" | "pop" | "zip" | "alert";
          volume: number;
        };
        observerStatus?: {
          normalizedEventType: "start" | "wait_input" | "stop" | "unknown";
          sessionKey: string;
        };
      };
      gitChanged: {
        workspaceWorktreePath: string;
      };
      workspaceFilesChanged: {
        workspaceWorktreePath: string;
        changedRelativePaths?: string[];
      };
      workspaceCreateProgress: {
        workspaceId: string;
        stepId: string;
        label: string;
        status: "pending" | "running" | "completed" | "failed" | "skipped" | "warning";
        message?: string;
        createdAt: string;
      };
      openBrowserUrl: {
        url: string;
        workspaceId: string;
        tabId: string;
        paneId: string;
      };
    };
  };
};

export type RpcFrontendMessageKey = keyof RpcSchema["toFrontend"]["messages"];
export type RpcFrontendMessagePayload<Key extends RpcFrontendMessageKey> = RpcSchema["toFrontend"]["messages"][Key];
