import { runSoundCommand } from "./spawn";
import type { SoundPlayer } from "./types";

/**
 * Creates one Windows player implementation backed by PowerShell playback.
 */
export function createWindowsSoundPlayer(): SoundPlayer {
  return {
    async play({ filePath }): Promise<void> {
      await runSoundCommand([
        "powershell",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(New-Object Media.SoundPlayer ${JSON.stringify(filePath)}).PlaySync()`,
      ]);
    },
  };
}
