import { runSoundCommand } from "./spawn";
import type { SoundPlayer } from "./types";

/**
 * Formats one normalized volume value to a shell-safe decimal argument understood by `afplay -v`.
 */
function formatDarwinVolume(volume: number): string {
  if (!Number.isFinite(volume)) {
    return "1";
  }

  if (volume <= 0) {
    return "0";
  }

  if (volume >= 1) {
    return "1";
  }

  return volume.toFixed(2);
}

/**
 * Creates one macOS player implementation backed by `afplay`.
 */
export function createDarwinSoundPlayer(): SoundPlayer {
  return {
    async play({ filePath, volume }): Promise<void> {
      await runSoundCommand(["afplay", "-v", formatDarwinVolume(volume), filePath]);
    },
  };
}
