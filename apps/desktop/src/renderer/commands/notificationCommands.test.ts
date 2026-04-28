// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchNotification,
  getNotificationPreferences,
  playNotificationSound,
  previewNotification,
  updateNotificationPreferences,
} from "./notificationCommands";

const mocks = vi.hoisted(() => ({
  dispatchNotification: vi.fn(),
  playNotificationSoundBridge: vi.fn(),
  requestJson: vi.fn(),
  setSessionData: vi.fn(),
  sessionState: {
    currentUser: {
      id: "user-1",
      email: "user@example.com",
      name: "User",
      avatarUrl: null,
      notificationPreferences: {
        enabled: true,
        osEnabled: true,
        soundEnabled: false,
        volume: 0.7,
        focusOnClick: true,
        enabledEventTypes: ["run-finished", "run-failed"],
        eventSounds: {
          "run-finished": "ping",
          "run-failed": "alert",
        },
        enabledCategories: ["ai-task"],
      },
    },
    organizations: [{ id: "org-1", name: "Org" }],
    selectedOrganizationId: "org-1",
  },
}));

vi.mock("../api/restClient", () => ({
  requestJson: (...args: unknown[]) => mocks.requestJson(...args),
}));

vi.mock("../rpc/rpcTransport", () => ({
  getDesktopHostBridge: vi.fn(() => ({
    dispatchNotification: mocks.dispatchNotification,
    playNotificationSound: mocks.playNotificationSoundBridge,
  })),
}));

vi.mock("../store/sessionStore", () => ({
  sessionStore: {
    getState: () => ({
      ...mocks.sessionState,
      setSessionData: mocks.setSessionData,
    }),
  },
}));

describe("notificationCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("loads preferences from current session user and caches them locally", async () => {
    window.localStorage.clear();

    const preferences = await getNotificationPreferences();
    expect(preferences.soundEnabled).toBe(false);
    expect(mocks.requestJson).not.toHaveBeenCalled();

    const cached = JSON.parse(window.localStorage.getItem("notifications.preferences.v1") ?? "{}");
    expect(cached.soundEnabled).toBe(false);
  });

  it("uses local cache when session user has no preferences", async () => {
    mocks.sessionState.currentUser = {
      ...mocks.sessionState.currentUser,
      notificationPreferences: undefined,
    };
    window.localStorage.setItem(
      "notifications.preferences.v1",
      JSON.stringify({
        enabled: true,
        osEnabled: true,
        soundEnabled: false,
        volume: 0.5,
        focusOnClick: true,
        enabledEventTypes: ["run-finished", "run-failed"],
        eventSounds: {
          "run-finished": "chime",
          "run-failed": "alert",
        },
        enabledCategories: ["ai-task"],
      }),
    );

    const preferences = await getNotificationPreferences();
    expect(preferences.soundEnabled).toBe(false);

    mocks.sessionState.currentUser = {
      ...mocks.sessionState.currentUser,
      notificationPreferences: {
        enabled: true,
        osEnabled: true,
        soundEnabled: false,
        volume: 0.7,
        focusOnClick: true,
        enabledEventTypes: ["run-finished", "run-failed"],
        eventSounds: {
          "run-finished": "ping",
          "run-failed": "alert",
        },
        enabledCategories: ["ai-task"],
      },
    };
  });

  it("updates preferences through api-service and refreshes cache", async () => {
    window.localStorage.clear();
    mocks.requestJson.mockResolvedValueOnce({
      preferences: {
        enabled: true,
        osEnabled: true,
        soundEnabled: true,
        volume: 0.9,
        focusOnClick: true,
        enabledEventTypes: ["run-finished", "run-failed"],
        eventSounds: {
          "run-finished": "zip",
          "run-failed": "alert",
        },
        enabledCategories: ["ai-task"],
      },
    });

    const updated = await updateNotificationPreferences({ soundEnabled: true, volume: 0.9 });
    expect(updated.volume).toBe(0.9);
    expect(mocks.requestJson).toHaveBeenCalledWith("/notification-preferences", {
      method: "PUT",
      body: { soundEnabled: true, volume: 0.9 },
    });

    const cached = JSON.parse(window.localStorage.getItem("notifications.preferences.v1") ?? "{}");
    expect(cached.volume).toBe(0.9);
    expect(mocks.setSessionData).toHaveBeenCalledTimes(1);
  });

  it("forwards notification requests to notification service", async () => {
    await previewNotification({ eventType: "run-finished" });
    await playNotificationSound({ soundId: "chime", volume: 0.9 });
    await dispatchNotification({ title: "Run completed", body: "Done" });

    expect(mocks.dispatchNotification).toHaveBeenCalledWith({
      title: "Run finished",
      body: "Notification preview",
    });
    expect(mocks.dispatchNotification).toHaveBeenCalledWith({ title: "Run completed", body: "Done" });
    expect(mocks.playNotificationSoundBridge).toHaveBeenCalledWith({ soundId: "chime", volume: 0.9 });
  });
});
