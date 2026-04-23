/** App-state key used to persist notification preferences. */
export const NOTIFICATION_PREFERENCES_STORAGE_KEY = "notifications.preferences.v1";

/** Maximum number of pending navigation paths queued from notification clicks. */
export const NOTIFICATION_MAX_PENDING_NAVIGATION_PATHS = 50;

/** Maximum visible error-message length rendered inside notification body copy. */
export const NOTIFICATION_MAX_ERROR_MESSAGE_LENGTH = 160;

/** Delay before preview status banners auto-hide in the notification settings UI. */
export const NOTIFICATION_PREVIEW_STATUS_AUTO_HIDE_MS = 2500;

/** Number of attempts used to load persisted notification preferences. */
export const NOTIFICATION_PREFERENCES_LOAD_RETRY_ATTEMPTS = 3;

/** Base delay in milliseconds used between preference-load retry attempts. */
export const NOTIFICATION_PREFERENCES_LOAD_RETRY_BASE_DELAY_MS = 200;

/** Default labels used for notification previews in settings when no runtime override is provided. */
export const DEFAULT_NOTIFICATION_PREVIEW_CONTEXT = {
  workspaceName: "Demo Workspace",
  chatName: "Release Assistant",
} as const;
