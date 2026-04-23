import { createDarwinSoundPlayer } from "./darwinPlayer";
import { createLinuxSoundPlayer } from "./linuxPlayer";
import type { SoundPlayer } from "./types";
import { createWindowsSoundPlayer } from "./windowsPlayer";

/**
 * Creates one platform-specific notification sound player.
 */
export function createSoundPlayer(platform?: NodeJS.Platform): SoundPlayer {
  const resolvedPlatform = platform ?? process.platform;

  if (resolvedPlatform === "darwin") {
    return createDarwinSoundPlayer();
  }

  if (resolvedPlatform === "linux") {
    return createLinuxSoundPlayer();
  }

  if (resolvedPlatform === "win32") {
    return createWindowsSoundPlayer();
  }

  throw new Error(`Unsupported platform for notification sound playback: ${resolvedPlatform}`);
}
