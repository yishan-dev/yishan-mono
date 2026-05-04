import { describe, expect, it, vi } from "vitest";
import { checkForUpdatesManually, startAutoUpdates } from "./autoUpdateService";

function createUpdater() {
  return {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdatesAndNotify: vi.fn().mockResolvedValue(undefined),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe("startAutoUpdates", () => {
  it("does not check for updates during development", () => {
    const updater = createUpdater();

    const result = startAutoUpdates({
      app: { isPackaged: true },
      updater,
      devMode: true,
    });

    expect(result).toEqual({ enabled: false, reason: "development" });
    expect(updater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it("does not check for updates from unpackaged builds", () => {
    const updater = createUpdater();

    const result = startAutoUpdates({
      app: { isPackaged: false },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ enabled: false, reason: "unpackaged" });
    expect(updater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
  });

  it("enables background update checks for packaged production builds", () => {
    const updater = createUpdater();

    const result = startAutoUpdates({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ enabled: true });
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(updater.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(updater.checkForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it("notifies the renderer when an update is downloaded", () => {
    const updater = createUpdater();
    const notifyUpdateReady = vi.fn();

    startAutoUpdates({
      app: { isPackaged: true },
      updater,
      devMode: false,
      notifyUpdateReady,
    });

    const availableListener = updater.on.mock.calls.find(([event]) => event === "update-available")?.[1];
    const downloadedListener = updater.on.mock.calls.find(([event]) => event === "update-downloaded")?.[1];

    availableListener?.({ version: "1.2.3" });
    downloadedListener?.({});

    expect(notifyUpdateReady).toHaveBeenCalledWith({ version: "1.2.3" });
  });
});

describe("checkForUpdatesManually", () => {
  it("returns not-available in development mode", async () => {
    const result = await checkForUpdatesManually({
      app: { isPackaged: true },
      devMode: true,
    });

    expect(result).toEqual({ status: "not-available", reason: "development" });
  });

  it("returns not-available for unpackaged builds", async () => {
    const result = await checkForUpdatesManually({
      app: { isPackaged: false },
      devMode: false,
    });

    expect(result).toEqual({ status: "not-available", reason: "unpackaged" });
  });

  it("returns update-available when an update is found", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockImplementation(() => {
      const listener = updater.once.mock.calls.find(([event]) => event === "update-available")?.[1];
      listener?.({ version: "2.0.0" });
      return Promise.resolve();
    });

    const result = await checkForUpdatesManually({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ status: "update-available", version: "2.0.0" });
  });

  it("returns up-to-date when no update is available", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockImplementation(() => {
      const listener = updater.once.mock.calls.find(([event]) => event === "update-not-available")?.[1];
      listener?.();
      return Promise.resolve();
    });

    const result = await checkForUpdatesManually({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ status: "up-to-date" });
  });

  it("returns error when the check fails", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockImplementation(() => {
      const listener = updater.once.mock.calls.find(([event]) => event === "error")?.[1];
      listener?.(new Error("Network unreachable"));
      return Promise.resolve();
    });

    const result = await checkForUpdatesManually({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ status: "error", message: "Network unreachable" });
  });

  it("returns error when checkForUpdates promise rejects", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error("Connection timeout"));

    const result = await checkForUpdatesManually({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(result).toEqual({ status: "error", message: "Connection timeout" });
  });

  it("cleans up event listeners after settling", async () => {
    const updater = createUpdater();
    updater.checkForUpdates.mockImplementation(() => {
      const listener = updater.once.mock.calls.find(([event]) => event === "update-not-available")?.[1];
      listener?.();
      return Promise.resolve();
    });

    await checkForUpdatesManually({
      app: { isPackaged: true },
      updater,
      devMode: false,
    });

    expect(updater.removeListener).toHaveBeenCalledWith("update-available", expect.any(Function));
    expect(updater.removeListener).toHaveBeenCalledWith("update-not-available", expect.any(Function));
    expect(updater.removeListener).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
