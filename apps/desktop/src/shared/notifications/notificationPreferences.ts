export const SUPPORTED_NOTIFICATION_EVENT_TYPES = ["run-finished", "run-failed"] as const;
export type NotificationEventType = (typeof SUPPORTED_NOTIFICATION_EVENT_TYPES)[number];
export const SUPPORTED_NOTIFICATION_SOUND_IDS = ["chime", "ping", "pop", "zip", "alert"] as const;
export type NotificationSoundId = (typeof SUPPORTED_NOTIFICATION_SOUND_IDS)[number];
export type NotificationEventSoundMap = Record<NotificationEventType, NotificationSoundId>;
export const SUPPORTED_NOTIFICATION_CATEGORIES = ["ai-task"] as const;
export type NotificationCategory = (typeof SUPPORTED_NOTIFICATION_CATEGORIES)[number];

export type NotificationPreferences = {
  enabled: boolean;
  osEnabled: boolean;
  soundEnabled: boolean;
  volume: number;
  focusOnClick: boolean;
  enabledEventTypes: NotificationEventType[];
  eventSounds: NotificationEventSoundMap;
  enabledCategories: NotificationCategory[];
};

const DEFAULT_ENABLED_NOTIFICATION_EVENTS = [...SUPPORTED_NOTIFICATION_EVENT_TYPES];
const DEFAULT_ENABLED_NOTIFICATION_CATEGORIES = [...SUPPORTED_NOTIFICATION_CATEGORIES];
const DEFAULT_EVENT_SOUNDS: NotificationEventSoundMap = {
  "run-finished": "chime",
  "run-failed": "alert",
};

/** Default notification preferences used when callers do not provide an override. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  osEnabled: true,
  soundEnabled: true,
  volume: 1,
  focusOnClick: true,
  enabledEventTypes: DEFAULT_ENABLED_NOTIFICATION_EVENTS,
  eventSounds: { ...DEFAULT_EVENT_SOUNDS },
  enabledCategories: DEFAULT_ENABLED_NOTIFICATION_CATEGORIES,
};
