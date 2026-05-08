import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationPreferencesPatch,
  normalizeNotificationPreferences,
} from "@/lib/notification-preferences";

export const SUPPORTED_LANGUAGE_CODES = ["en", "zh"] as const;
export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];
export const DEFAULT_LANGUAGE_CODE: SupportedLanguageCode = "en";

export type UserPreferences = {
  languagePreference: SupportedLanguageCode;
  notificationPreferences: NotificationPreferences;
};

export type UserPreferencesPatch = {
  languagePreference?: string;
  notificationPreferences?: NotificationPreferencesPatch;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  languagePreference: DEFAULT_LANGUAGE_CODE,
  notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
};

/**
 * Normalizes one language code payload into the closest supported language.
 */
export function normalizeLanguagePreference(input: string | null | undefined): SupportedLanguageCode {
  const candidate = input?.trim().toLowerCase();
  if (!candidate) {
    return DEFAULT_LANGUAGE_CODE;
  }

  if (candidate.startsWith("zh")) {
    return "zh";
  }

  const baseLanguage = candidate.split(/[-_]/)[0];
  if (baseLanguage && SUPPORTED_LANGUAGE_CODES.includes(baseLanguage as SupportedLanguageCode)) {
    return baseLanguage as SupportedLanguageCode;
  }

  return DEFAULT_LANGUAGE_CODE;
}

/**
 * Normalizes one stored user preferences payload into one full runtime-safe snapshot.
 */
export function normalizeUserPreferences(stored: unknown): UserPreferences {
  const candidate = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};

  return {
    languagePreference: normalizeLanguagePreference(
      typeof candidate.languagePreference === "string" ? candidate.languagePreference : undefined,
    ),
    notificationPreferences: normalizeNotificationPreferences(candidate.notificationPreferences),
  };
}

/**
 * Merges one partial user-preferences patch into one normalized full payload.
 */
export function mergeUserPreferences(current: unknown, patch: UserPreferencesPatch): UserPreferences {
  const normalizedCurrent = normalizeUserPreferences(current);

  return {
    languagePreference:
      patch.languagePreference !== undefined
        ? normalizeLanguagePreference(patch.languagePreference)
        : normalizedCurrent.languagePreference,
    notificationPreferences:
      patch.notificationPreferences !== undefined
        ? normalizeNotificationPreferences(
            {
              ...normalizedCurrent.notificationPreferences,
              ...patch.notificationPreferences,
              eventSounds: {
                ...normalizedCurrent.notificationPreferences.eventSounds,
                ...patch.notificationPreferences.eventSounds,
              },
            },
            normalizedCurrent.notificationPreferences,
          )
        : normalizedCurrent.notificationPreferences,
  };
}
