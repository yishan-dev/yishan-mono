import type { App } from "electron";
import { autoUpdater } from "electron-updater";
import type { DesktopUpdateEventPayload } from "../ipc";
import { isDevMode } from "../runtime/environment";

type AutoUpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdatesAndNotify: () => Promise<unknown>;
  checkForUpdates: () => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  once: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

type AutoUpdateLogger = Pick<Console, "info" | "warn">;

export type AutoUpdateStartResult = { enabled: true } | { enabled: false; reason: "development" | "unpackaged" };

type StartAutoUpdatesInput = {
  app: Pick<App, "isPackaged">;
  updater?: AutoUpdaterLike;
  devMode?: boolean;
  logger?: AutoUpdateLogger;
  notifyUpdateReady?: (payload: DesktopUpdateEventPayload) => void;
};

function readUpdateVersion(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || !("version" in input)) {
    return undefined;
  }

  const version = (input as { version?: unknown }).version;
  return typeof version === "string" && version.trim() ? version : undefined;
}

/** Starts packaged-app update checks without interrupting local development sessions. */
export function startAutoUpdates({
  app,
  updater: inputUpdater,
  devMode = isDevMode(),
  logger = console,
  notifyUpdateReady,
}: StartAutoUpdatesInput): AutoUpdateStartResult {
  const updater = inputUpdater ?? (autoUpdater as unknown as AutoUpdaterLike);
  let availableVersion: string | undefined;

  if (devMode) {
    return { enabled: false, reason: "development" };
  }

  if (!app.isPackaged) {
    return { enabled: false, reason: "unpackaged" };
  }

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on("checking-for-update", () => {
    logger.info("Checking for desktop app updates");
  });
  updater.on("update-available", (info) => {
    availableVersion = readUpdateVersion(info);
    logger.info("Desktop app update available; downloading in background");
  });
  updater.on("update-not-available", () => {
    logger.info("Desktop app is up to date");
  });
  updater.on("update-downloaded", (info) => {
    availableVersion = readUpdateVersion(info) ?? availableVersion;
    logger.info("Desktop app update downloaded; it will install when the app quits");
    notifyUpdateReady?.({ version: availableVersion });
  });
  updater.on("error", (error) => {
    logger.warn("Desktop app update check failed", error);
  });

  void updater.checkForUpdatesAndNotify().catch((error: unknown) => {
    logger.warn("Failed to start desktop app update check", error);
  });

  return { enabled: true };
}

export type ManualUpdateCheckResult =
  | { status: "update-available"; version?: string }
  | { status: "up-to-date" }
  | { status: "error"; message: string }
  | { status: "not-available"; reason: "development" | "unpackaged" };

type CheckForUpdatesManuallyInput = {
  app: Pick<App, "isPackaged">;
  updater?: AutoUpdaterLike;
  devMode?: boolean;
  logger?: AutoUpdateLogger;
};

/** Performs a one-shot manual update check and returns the outcome. */
export async function checkForUpdatesManually({
  app,
  updater: inputUpdater,
  devMode = isDevMode(),
  logger = console,
}: CheckForUpdatesManuallyInput): Promise<ManualUpdateCheckResult> {
  if (devMode) {
    return { status: "not-available", reason: "development" };
  }

  if (!app.isPackaged) {
    return { status: "not-available", reason: "unpackaged" };
  }

  const updater = inputUpdater ?? (autoUpdater as unknown as AutoUpdaterLike);

  return new Promise<ManualUpdateCheckResult>((resolve) => {
    let settled = false;

    const settle = (result: ManualUpdateCheckResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onUpdateAvailable = (info: unknown) => {
      const version = readUpdateVersion(info);
      logger.info("Manual update check: update available", version);
      settle({ status: "update-available", version });
    };

    const onUpdateNotAvailable = () => {
      logger.info("Manual update check: already up to date");
      settle({ status: "up-to-date" });
    };

    const onError = (error: unknown) => {
      const message = error instanceof Error ? error.message : "Update check failed";
      logger.warn("Manual update check failed", error);
      settle({ status: "error", message });
    };

    const cleanup = () => {
      updater.removeListener("update-available", onUpdateAvailable);
      updater.removeListener("update-not-available", onUpdateNotAvailable);
      updater.removeListener("error", onError);
    };

    updater.once("update-available", onUpdateAvailable);
    updater.once("update-not-available", onUpdateNotAvailable);
    updater.once("error", onError);

    updater.checkForUpdates().catch((error: unknown) => {
      settle({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to check for updates",
      });
    });
  });
}
