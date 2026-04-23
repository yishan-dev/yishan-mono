import type { DesktopRpcEventEnvelope } from "../../main/ipc";
import type { RpcFrontendMessageKey, RpcFrontendMessagePayload } from "../../shared/contracts/rpcSchema";

const FRONTEND_MESSAGE_KEYS = [
  "appAction",
  "chatEvent",
  "notificationEvent",
  "gitChanged",
  "workspaceFilesChanged",
] as const satisfies readonly RpcFrontendMessageKey[];

const FRONTEND_MESSAGE_KEY_SET = new Set<string>(FRONTEND_MESSAGE_KEYS);

export type BackendEventName =
  | "app.action"
  | "chat.event"
  | "notification.event"
  | "git.changed"
  | "workspace.files.changed";

export type NormalizedBackendEvent =
  | {
      source: "appAction";
      name: "app.action";
      payload: RpcFrontendMessagePayload<"appAction">;
    }
  | {
      source: "chatEvent";
      name: "chat.event";
      payload: RpcFrontendMessagePayload<"chatEvent">;
    }
  | {
      source: "notificationEvent";
      name: "notification.event";
      payload: RpcFrontendMessagePayload<"notificationEvent">;
    }
  | {
      source: "gitChanged";
      name: "git.changed";
      payload: RpcFrontendMessagePayload<"gitChanged">;
    }
  | {
      source: "workspaceFilesChanged";
      name: "workspace.files.changed";
      payload: RpcFrontendMessagePayload<"workspaceFilesChanged">;
    };

/**
 * Maps backend RPC method keys to normalized event names used by the renderer event pipeline.
 */
export const BACKEND_EVENT_NAME_BY_SOURCE = {
  appAction: "app.action",
  chatEvent: "chat.event",
  notificationEvent: "notification.event",
  gitChanged: "git.changed",
  workspaceFilesChanged: "workspace.files.changed",
} as const satisfies Record<RpcFrontendMessageKey, BackendEventName>;

/**
 * Returns true when a raw RPC method string is one of the frontend message keys.
 */
function isRpcFrontendMessageKey(value: string): value is RpcFrontendMessageKey {
  return FRONTEND_MESSAGE_KEY_SET.has(value);
}

/**
 * Returns true when a value is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Returns true when observer lifecycle metadata uses the expected runtime shape.
 */
function isNotificationObserverStatusPayload(
  value: unknown,
): value is NonNullable<RpcFrontendMessagePayload<"notificationEvent">["observerStatus"]> {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.normalizedEventType !== "start" &&
    value.normalizedEventType !== "wait_input" &&
    value.normalizedEventType !== "stop" &&
    value.normalizedEventType !== "unknown"
  ) {
    return false;
  }

  return typeof value.sessionKey === "string";
}

/**
 * Returns true when one notification event payload satisfies the renderer runtime contract.
 */
function isNotificationEventPayload(
  payload: Record<string, unknown>,
): payload is RpcFrontendMessagePayload<"notificationEvent"> {
  if (
    typeof payload.id !== "string" ||
    typeof payload.title !== "string" ||
    (payload.body !== undefined && typeof payload.body !== "string") ||
    (payload.tone !== "success" && payload.tone !== "error") ||
    typeof payload.createdAt !== "string" ||
    (payload.workspaceId !== undefined && typeof payload.workspaceId !== "string") ||
    (payload.sessionId !== undefined && typeof payload.sessionId !== "string") ||
    (payload.navigationPath !== undefined && typeof payload.navigationPath !== "string") ||
    (payload.silent !== undefined && typeof payload.silent !== "boolean") ||
    (payload.showSystemNotification !== undefined && typeof payload.showSystemNotification !== "boolean") ||
    !isNotificationSoundPayload(payload.soundToPlay)
  ) {
    return false;
  }

  if (payload.observerStatus !== undefined && !isNotificationObserverStatusPayload(payload.observerStatus)) {
    return false;
  }

  return true;
}

/** Returns true when one optional notification sound payload has the supported runtime shape. */
function isNotificationSoundPayload(
  value: unknown,
): value is NonNullable<RpcFrontendMessagePayload<"notificationEvent">["soundToPlay"]> {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.soundId !== "chime" &&
    value.soundId !== "ping" &&
    value.soundId !== "pop" &&
    value.soundId !== "zip" &&
    value.soundId !== "alert"
  ) {
    return false;
  }

  return typeof value.volume === "number" && Number.isFinite(value.volume) && value.volume >= 0;
}

/**
 * Normalizes and validates one backend IPC event envelope.
 *
 * Returns `null` when the method key is unknown or required payload fields are invalid.
 */
export function normalizeBackendEvent(envelope: DesktopRpcEventEnvelope): NormalizedBackendEvent | null {
  if (!isRpcFrontendMessageKey(envelope.method)) {
    return null;
  }

  const payload = envelope.payload;
  if (!isRecord(payload)) {
    return null;
  }

  if (envelope.method === "chatEvent") {
    if (
      typeof payload.workspaceId !== "string" ||
      typeof payload.sessionId !== "string" ||
      !isRecord(payload.event) ||
      typeof payload.event.type !== "string"
    ) {
      return null;
    }

    return {
      source: "chatEvent",
      name: BACKEND_EVENT_NAME_BY_SOURCE.chatEvent,
      payload: payload as RpcFrontendMessagePayload<"chatEvent">,
    };
  }

  if (envelope.method === "notificationEvent") {
    if (!isNotificationEventPayload(payload)) {
      return null;
    }

    return {
      source: "notificationEvent",
      name: BACKEND_EVENT_NAME_BY_SOURCE.notificationEvent,
      payload: payload as RpcFrontendMessagePayload<"notificationEvent">,
    };
  }

  if (envelope.method === "gitChanged") {
    if (typeof payload.workspaceWorktreePath !== "string") {
      return null;
    }

    return {
      source: "gitChanged",
      name: BACKEND_EVENT_NAME_BY_SOURCE.gitChanged,
      payload: payload as RpcFrontendMessagePayload<"gitChanged">,
    };
  }

  if (envelope.method === "workspaceFilesChanged") {
    const changedRelativePaths = payload.changedRelativePaths;
    const hasValidChangedRelativePaths =
      changedRelativePaths === undefined ||
      (Array.isArray(changedRelativePaths) && changedRelativePaths.every((path) => typeof path === "string"));
    if (typeof payload.workspaceWorktreePath !== "string" || !hasValidChangedRelativePaths) {
      return null;
    }

    return {
      source: "workspaceFilesChanged",
      name: BACKEND_EVENT_NAME_BY_SOURCE.workspaceFilesChanged,
      payload: payload as RpcFrontendMessagePayload<"workspaceFilesChanged">,
    };
  }

  if (typeof payload.action !== "string") {
    return null;
  }

  return {
    source: "appAction",
    name: BACKEND_EVENT_NAME_BY_SOURCE.appAction,
    payload: payload as RpcFrontendMessagePayload<"appAction">,
  };
}
