import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { BrowserWindow, Menu, app, dialog, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import type { AppActionPayload } from "../shared/contracts/actions";
import { configureApplicationMenu } from "./app/menu";
import { getAuthStatus, getAuthTokens, login } from "./auth/cliAuth";
import { DaemonManager } from "./daemon/daemonManager";
import { getDaemonQuitOnExit, setDaemonQuitOnExit } from "./daemon/daemonSettings";
import { launchPath, openExternalUrl } from "./integrations/externalAppLauncher";
import { readExternalClipboardSourcePathsFromSystem } from "./integrations/externalClipboardPipeline";
import { DESKTOP_RPC_IPC_CHANNELS, type DesktopUpdateEventPayload, HOST_IPC_CHANNELS } from "./ipc";
import { createDesktopNotificationHostAdapter } from "./notifications/service";
import { isDevMode } from "./runtime/environment";
import { checkForUpdatesManually, startAutoUpdates } from "./updates/autoUpdateService";

type DispatchActionOptions = {
  focusApp?: boolean;
};

/**
 * Owns Electron desktop lifecycle and main window bootstrap.
 */
export class DesktopApplication {
  private mainWindow: BrowserWindow | null = null;
  private readonly daemonManager = new DaemonManager();
  private hasProcessedBeforeQuit = false;
  private isQuitting = false;
  private pendingUpdateReady: DesktopUpdateEventPayload | null = null;
  private cachedDaemonQuitOnExit: boolean | null = null;

  /**
   * Starts the desktop app and exits on startup failure.
   */
  static run() {
    const desktopApplication = new DesktopApplication();

    desktopApplication.start().catch(async (error: unknown) => {
      console.error("Failed to start desktop application", error);
      try {
        await desktopApplication.daemonManager.stop();
      } catch (stopError) {
        console.warn("Failed to stop daemon service after startup failure", stopError);
      } finally {
        app.exit(1);
      }
    });
  }

  /**
   * Binds Electron lifecycle hooks and creates the initial window.
   */
  private async start(): Promise<void> {
    await app.whenReady();

    // Override the runtime app name so native menus, About dialog, and
    // other OS-level surfaces show "Yishan" instead of the scoped
    // package name "@yishan/desktop".
    app.setName("Yishan");

    // Pre-load daemon settings so before-quit has the correct value even
    // when the user never opens the Settings view during this session.
    try {
      this.cachedDaemonQuitOnExit = await getDaemonQuitOnExit();
    } catch (error: unknown) {
      console.warn("Failed to load daemon quit-on-exit setting:", error);
      this.cachedDaemonQuitOnExit = false;
    }

    await this.daemonManager.ensureStarted();
    this.registerHostIpcHandlers();
    this.registerAuthIpcHandlers();
    this.createMainWindow();
    configureApplicationMenu({
      appName: "Yishan",
      devMode: isDevMode(),
      dispatchAction: (payload, options) => {
        this.dispatchAction(payload, options);
      },
      checkForUpdates: () => {
        void this.handleManualUpdateCheck();
      },
    });
    startAutoUpdates({
      app,
      notifyUpdateReady: (payload) => {
        this.dispatchUpdateReady(payload);
      },
    });

    app.on("before-quit", (event) => {
      this.isQuitting = true;

      if (this.hasProcessedBeforeQuit) {
        return;
      }

      event.preventDefault();
      this.hasProcessedBeforeQuit = true;

      const shouldStopDaemon = isDevMode() || (this.cachedDaemonQuitOnExit ?? false);
      const cleanup = shouldStopDaemon
        ? this.daemonManager.stop().catch((error: unknown) => {
            console.warn("Failed to stop daemon service during desktop shutdown", error);
          })
        : Promise.resolve();

      void cleanup.finally(() => {
        app.quit();
      });
    });

    app.on("activate", () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.show();
      } else {
        this.createMainWindow();
      }
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin" || this.isQuitting) {
        app.quit();
      }
    });
  }

  /** Registers desktop auth IPC endpoints backed by the bundled CLI login/status commands. */
  private registerAuthIpcHandlers() {
    ipcMain.handle(HOST_IPC_CHANNELS.getAuthStatus, async () => {
      return await getAuthStatus();
    });

    ipcMain.handle(HOST_IPC_CHANNELS.login, async () => {
      return await login();
    });

    ipcMain.handle(HOST_IPC_CHANNELS.getAuthTokens, async () => {
      return await getAuthTokens();
    });

    ipcMain.handle(HOST_IPC_CHANNELS.getDaemonInfo, async () => {
      return await this.daemonManager.getInfo();
    });

    ipcMain.handle(HOST_IPC_CHANNELS.restartDaemon, async () => {
      try {
        await this.daemonManager.stop();
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Failed to stop daemon";
        console.warn("Daemon stop during restart:", reason);
      }

      try {
        await this.daemonManager.ensureStarted();
        const info = await this.daemonManager.getInfo();
        return { success: true as const, daemonInfo: info };
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.message : "Failed to start daemon";
        return { success: false as const, error: reason };
      }
    });

    ipcMain.handle(HOST_IPC_CHANNELS.getDaemonQuitOnExit, async () => {
      try {
        if (this.cachedDaemonQuitOnExit === null) {
          this.cachedDaemonQuitOnExit = await getDaemonQuitOnExit();
        }
        return this.cachedDaemonQuitOnExit;
      } catch (error: unknown) {
        console.warn("Failed to read daemon quit-on-exit setting:", error);
        return false;
      }
    });

    ipcMain.handle(HOST_IPC_CHANNELS.setDaemonQuitOnExit, async (_event, value: boolean) => {
      await setDaemonQuitOnExit(value);
      this.cachedDaemonQuitOnExit = value;
      return { ok: true as const };
    });
  }

  /** Registers desktop host IPC endpoints used by renderer shell/runtime commands. */
  private registerHostIpcHandlers() {
    const notificationAdapter = createDesktopNotificationHostAdapter();

    ipcMain.handle(HOST_IPC_CHANNELS.openLocalFolderDialog, async (_event, input) => {
      const options: Electron.OpenDialogOptions = {
        properties: ["openDirectory", "createDirectory"],
        defaultPath: input?.startingFolder?.trim() || undefined,
      };
      const result = this.mainWindow
        ? await dialog.showOpenDialog(this.mainWindow, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled) {
        return null;
      }

      return result.filePaths[0] ?? null;
    });

    ipcMain.handle(HOST_IPC_CHANNELS.toggleMainWindowMaximized, async () => {
      const window = this.mainWindow;
      if (!window) {
        return { ok: true };
      }

      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }

      return { ok: true };
    });

    ipcMain.handle(HOST_IPC_CHANNELS.getMainWindowFullscreenState, async () => {
      return {
        isFullscreen: this.mainWindow?.isFullScreen() ?? false,
      };
    });

    ipcMain.handle(HOST_IPC_CHANNELS.openEntryInExternalApp, async (_event, input) => {
      const absolutePath = resolve(input.workspaceWorktreePath, input.relativePath ?? ".");
      if (input.appId === "system-file-manager") {
        let isDirectory = true;
        try {
          isDirectory = statSync(absolutePath).isDirectory();
        } catch {
          isDirectory = true;
        }

        await launchPath({
          kind: "system-file-manager",
          path: absolutePath,
          isDirectory,
        });
      } else {
        await launchPath({
          kind: "external-app",
          path: absolutePath,
          appId: input.appId,
        });
      }

      return { ok: true };
    });

    ipcMain.handle(HOST_IPC_CHANNELS.openExternalUrl, async (_event, input) => {
      return await openExternalUrl(input.url);
    });

    ipcMain.handle(HOST_IPC_CHANNELS.readExternalClipboardSourcePaths, async () => {
      return await readExternalClipboardSourcePathsFromSystem();
    });

    ipcMain.handle(HOST_IPC_CHANNELS.dispatchNotification, async (_event, input) => {
      const notificationResult = await notificationAdapter.driver.show({
        title: input.title,
        body: input.body,
      });

      return {
        sent: true,
        notificationId: notificationResult?.notificationId,
      };
    });

    ipcMain.handle(HOST_IPC_CHANNELS.playNotificationSound, async (_event, input) => {
      await notificationAdapter.playSound({
        eventType: "run-finished",
        soundId: input.soundId,
        volume: input.volume,
      });

      return {
        played: true,
      };
    });

    ipcMain.handle(HOST_IPC_CHANNELS.getPendingUpdate, async () => {
      return this.pendingUpdateReady;
    });

    ipcMain.handle(HOST_IPC_CHANNELS.installUpdate, async () => {
      autoUpdater.quitAndInstall();
      return { ok: true };
    });
  }

  /** Focuses the main window when menu actions should bring the app forward. */
  private focusMainWindow(): void {
    this.mainWindow?.show();
    this.mainWindow?.focus();
  }

  /** Forwards one native menu action to renderer listeners. */
  private dispatchAction(payload: AppActionPayload, options?: DispatchActionOptions): void {
    this.mainWindow?.webContents.send(DESKTOP_RPC_IPC_CHANNELS.event, {
      method: "appAction",
      payload,
    });

    if (options?.focusApp) {
      this.focusMainWindow();
    }
  }

  /** Forwards a downloaded app update event to renderer update prompts. */
  private dispatchUpdateReady(payload: DesktopUpdateEventPayload): void {
    this.pendingUpdateReady = payload;
    this.mainWindow?.webContents.send(DESKTOP_RPC_IPC_CHANNELS.event, {
      method: "desktopUpdateReady",
      payload,
    });
  }

  /** Handles a manual "Check for Updates" request from the native menu. */
  private async handleManualUpdateCheck(): Promise<void> {
    const parentWindow = this.mainWindow ?? undefined;

    // Disable the menu item while checking to provide visual feedback.
    this.setUpdateMenuItemEnabled(false, "Checking for Updates…");

    try {
      const result = await checkForUpdatesManually({ app });

      // Restore the menu item before showing the result dialog.
      this.setUpdateMenuItemEnabled(true);

      switch (result.status) {
        case "update-available": {
          const versionLabel = result.version ? ` ${result.version}` : "";
          const options: Electron.MessageBoxOptions = {
            type: "info",
            buttons: ["Download and Install", "Later"],
            defaultId: 0,
            cancelId: 1,
            title: "Update Available",
            message: `A new version${versionLabel} is available.`,
            detail: "Would you like to download and install it now? The app will restart to apply the update.",
          };
          const response = parentWindow
            ? await dialog.showMessageBox(parentWindow, options)
            : await dialog.showMessageBox(options);

          if (response.response === 0) {
            autoUpdater.quitAndInstall();
          }
          break;
        }
        case "up-to-date": {
          const options: Electron.MessageBoxOptions = {
            type: "info",
            buttons: ["OK"],
            title: "No Updates Available",
            message: "You're up to date!",
            detail: `Yishan ${app.getVersion()} is the latest version.`,
          };
          if (parentWindow) {
            await dialog.showMessageBox(parentWindow, options);
          } else {
            await dialog.showMessageBox(options);
          }
          break;
        }
        case "error": {
          const options: Electron.MessageBoxOptions = {
            type: "error",
            buttons: ["OK"],
            title: "Update Check Failed",
            message: "Unable to check for updates.",
            detail: result.message,
          };
          if (parentWindow) {
            await dialog.showMessageBox(parentWindow, options);
          } else {
            await dialog.showMessageBox(options);
          }
          break;
        }
        case "not-available": {
          const reason =
            result.reason === "development"
              ? "Update checking is not available in development mode."
              : "Update checking is not available for unpackaged builds.";
          const options: Electron.MessageBoxOptions = {
            type: "info",
            buttons: ["OK"],
            title: "Updates Not Available",
            message: "Cannot check for updates.",
            detail: reason,
          };
          if (parentWindow) {
            await dialog.showMessageBox(parentWindow, options);
          } else {
            await dialog.showMessageBox(options);
          }
          break;
        }
      }
    } catch (error: unknown) {
      this.setUpdateMenuItemEnabled(true);
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";
      const options: Electron.MessageBoxOptions = {
        type: "error",
        buttons: ["OK"],
        title: "Update Check Failed",
        message: "Unable to check for updates.",
        detail: message,
      };
      if (parentWindow) {
        await dialog.showMessageBox(parentWindow, options);
      } else {
        await dialog.showMessageBox(options);
      }
    }
  }

  /** Updates the "Check for Updates" menu item's enabled state and label. */
  private setUpdateMenuItemEnabled(enabled: boolean, label = "Check for Updates"): void {
    const menu = Menu.getApplicationMenu();
    if (!menu) return;

    const appMenu = menu.items[0]?.submenu;
    if (!appMenu) return;

    const updateItem = appMenu.items.find(
      (item) => item.label === "Check for Updates" || item.label === "Checking for Updates…",
    );
    if (updateItem) {
      updateItem.enabled = enabled;
      updateItem.label = label;
    }
  }

  /**
   * Creates and initializes the main BrowserWindow instance.
   */
  private createMainWindow() {
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: "hiddenInset",
      webPreferences: {
        preload: join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // On macOS, intercept the window close to hide instead of destroy,
    // allowing the app to stay in the Dock. During a quit flow, allow
    // the close to proceed so the app can fully terminate.
    if (process.platform === "darwin") {
      mainWindow.on("close", (event) => {
        if (!this.isQuitting) {
          event.preventDefault();
          mainWindow.hide();
        }
      });
    }

    mainWindow.on("closed", () => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null;
      }
    });

    const rendererUrl = process.env.ELECTRON_RENDERER_URL;

    if (rendererUrl) {
      void mainWindow.loadURL(rendererUrl);
      mainWindow.webContents.openDevTools({ mode: "detach" });
    } else {
      void mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
    }

    this.mainWindow = mainWindow;
  }
}
