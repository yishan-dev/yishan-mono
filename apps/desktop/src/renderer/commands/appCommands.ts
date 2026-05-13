import type { AppendBrowserHistoryInput, AuthStatusResult, BrowserHistoryGroup, DaemonInfoResult, DaemonRestartResult } from "../../main/ipc";
import type { DesktopAgentKind } from "../helpers/agentSettings";
import { getDaemonClient, getDesktopHostBridge } from "../rpc/rpcTransport";

/** Opens one native folder picker and returns a selected directory path when available. */
export async function openLocalFolderDialog(startingFolder?: string) {
  return await getDesktopHostBridge().openLocalFolderDialog({ startingFolder });
}

/** Reads default workspace worktree location from backend app settings. */
export async function getDefaultWorktreeLocation() {
  const client = await getDaemonClient();
  const response = await client.app.getDefaultWorktreeLocation(undefined);
  return response.worktreePath;
}

/** Checks whether one agent global config grants external directory access. */
export async function checkAgentGlobalConfigExternalDirectoryPermission(params?: { agentKind?: DesktopAgentKind }) {
  const client = await getDaemonClient();
  return client.app.checkAgentGlobalConfigExternalDirectoryPermission(params ?? {});
}

/** Ensures one agent global config grants external directory access. */
export async function ensureAgentGlobalConfigExternalDirectoryPermission(params?: { agentKind?: DesktopAgentKind }) {
  const client = await getDaemonClient();
  return client.app.ensureAgentGlobalConfigExternalDirectoryPermission(params ?? {});
}

/** Toggles the main desktop window maximized state. */
export async function toggleMainWindowMaximized() {
  return await getDesktopHostBridge().toggleMainWindowMaximized();
}

/** Returns whether the main desktop window currently runs in fullscreen mode. */
export async function getMainWindowFullscreenState() {
  return await getDesktopHostBridge().getMainWindowFullscreenState();
}

/** Opens one URL through the Electron main-process host bridge. */
export async function openExternalUrl(url: string) {
  return await getDesktopHostBridge().openExternalUrl({ url });
}

/** Reads current desktop authentication status from main-process IPC. */
export async function getAuthStatus(): Promise<AuthStatusResult> {
  try {
    const client = await getDaemonClient();
    const result = await client.app.checkAuthStatus();
    return {
      authenticated: result.authenticated,
      expiresAt: result.accessTokenExpiresAt,
    };
  } catch {
    return { authenticated: false };
  }
}

/** Reads current daemon identity and version from desktop main-process IPC. */
export async function getDaemonInfo(): Promise<DaemonInfoResult> {
  return await getDesktopHostBridge().getDaemonInfo();
}

/** Restarts the local daemon through the desktop main process. */
export async function restartDaemon(): Promise<DaemonRestartResult> {
  return await getDesktopHostBridge().restartDaemon();
}

/** Reads the persisted quit-daemon-before-app-exit setting. */
export async function getDaemonQuitOnExit(): Promise<boolean> {
  return await getDesktopHostBridge().getDaemonQuitOnExit();
}

/** Persists the quit-daemon-before-app-exit setting. */
export async function setDaemonQuitOnExit(value: boolean): Promise<void> {
  await getDesktopHostBridge().setDaemonQuitOnExit(value);
}

/** Runs one desktop login flow through main-process IPC. */
export async function login() {
  const result = await getDesktopHostBridge().login();
  if (result.authenticated) {
    try {
      const daemonClient = await getDaemonClient();
      await daemonClient.app.reloadAuthConfig();
    } catch {}
  }
  return result;
}

export async function loadBrowserHistory(): Promise<BrowserHistoryGroup[]> {
  return await getDesktopHostBridge().loadBrowserHistory();
}

export async function appendBrowserHistory(input: AppendBrowserHistoryInput): Promise<{ ok: true }> {
  return await getDesktopHostBridge().appendBrowserHistory(input);
}
