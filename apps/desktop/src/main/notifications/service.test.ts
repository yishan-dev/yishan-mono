import { beforeEach, describe, expect, it, vi } from "vitest";

const createSoundPlayerMock = vi.fn();
const createElectrobunNotificationDriverMock = vi.fn();
const resolveDesktopSoundDirectoryMock = vi.fn(() => "/sounds");

vi.mock("./soundRuntime", () => ({
  createSoundPlayer: createSoundPlayerMock,
}));

vi.mock("./electrobunNotificationDriver", () => ({
  createElectrobunNotificationDriver: createElectrobunNotificationDriverMock,
}));

vi.mock("./soundDirectory", () => ({
  resolveDesktopSoundDirectory: resolveDesktopSoundDirectoryMock,
}));

describe("createDesktopNotificationHostAdapter", () => {
  beforeEach(() => {
    createSoundPlayerMock.mockReset();
    createElectrobunNotificationDriverMock.mockReset();
    resolveDesktopSoundDirectoryMock.mockReset();
    resolveDesktopSoundDirectoryMock.mockReturnValue("/sounds");
  });

  it("returns desktop notification driver and click-action callback", async () => {
    const driver = {
      show: vi.fn(async () => ({ notificationId: "notification-1" })),
    };
    const onNotificationClickAction = vi.fn();

    createElectrobunNotificationDriverMock.mockReturnValue(driver);
    createSoundPlayerMock.mockReturnValue({
      play: vi.fn(async () => undefined),
    });

    const { createDesktopNotificationHostAdapter } = await import("./service");
    const adapter = createDesktopNotificationHostAdapter({
      onNotificationClickAction,
    });

    expect(adapter.driver).toBe(driver);
    expect(adapter.onNotificationClickAction).toBe(onNotificationClickAction);
  });

  it("maps sound identifiers to filesystem sound files", async () => {
    const play = vi.fn(async () => undefined);

    createElectrobunNotificationDriverMock.mockReturnValue({
      show: vi.fn(async () => ({ notificationId: "notification-1" })),
    });
    createSoundPlayerMock.mockReturnValue({
      play,
    });

    const { createDesktopNotificationHostAdapter } = await import("./service");
    const adapter = createDesktopNotificationHostAdapter();

    await adapter.playSound({
      soundId: "chime",
      volume: 0.7,
      eventType: "run-finished",
    });

    expect(resolveDesktopSoundDirectoryMock).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith({
      filePath: "/sounds/ding-dong.wav",
      volume: 0.7,
    });
  });

  it("uses windows separators when desktop sound root uses windows paths", async () => {
    const play = vi.fn(async () => undefined);

    resolveDesktopSoundDirectoryMock.mockReturnValue("C:\\sounds");
    createElectrobunNotificationDriverMock.mockReturnValue({
      show: vi.fn(async () => ({ notificationId: "notification-1" })),
    });
    createSoundPlayerMock.mockReturnValue({
      play,
    });

    const { createDesktopNotificationHostAdapter } = await import("./service");
    const adapter = createDesktopNotificationHostAdapter();

    await adapter.playSound({
      soundId: "alert",
      volume: 1,
      eventType: "run-failed",
    });

    expect(play).toHaveBeenCalledWith({
      filePath: "C:\\sounds\\bleep-descending.wav",
      volume: 1,
    });
  });
});
