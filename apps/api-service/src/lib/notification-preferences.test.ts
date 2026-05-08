import { describe, expect, it } from "vitest";
import { normalizeNotificationPreferences } from "./notification-preferences";

describe("normalizeNotificationPreferences", () => {
  it("enables newly added notification events for existing preference snapshots", () => {
    const preferences = normalizeNotificationPreferences({
      enabled: true,
      osEnabled: true,
      soundEnabled: true,
      volume: 0.7,
      focusOnClick: true,
      enabledEventTypes: ["run-finished", "run-failed"],
      eventSounds: {
        "run-finished": "chime",
        "run-failed": "alert",
      },
      enabledCategories: ["ai-task"],
    });

    expect(preferences.enabledEventTypes).toContain("pending-question");
    expect(preferences.eventSounds["pending-question"]).toBe("ping");
  });
});
