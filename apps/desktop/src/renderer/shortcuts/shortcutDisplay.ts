import type { ExternalAppPlatform } from "../../shared/contracts/externalApps";
import { getSupportedKeyBindingById } from "./keybindings";

/** Formats one key-token sequence into one UI-facing hotkey string. */
export function formatShortcutDisplay(keys: readonly string[]): string {
  return keys.join("+");
}

/** Returns one platform-specific hotkey label for one shortcut id when available. */
export function getShortcutDisplayLabelById(shortcutId: string, platform: ExternalAppPlatform): string | null {
  const keyBinding = getSupportedKeyBindingById(shortcutId);
  if (!keyBinding) {
    return null;
  }

  const displayKeys = platform === "darwin" ? keyBinding.macKeys : keyBinding.windowsKeys;
  if (displayKeys.length === 0) {
    return null;
  }

  return formatShortcutDisplay(displayKeys);
}
