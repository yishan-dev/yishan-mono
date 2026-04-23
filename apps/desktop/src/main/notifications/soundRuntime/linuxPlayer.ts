import { runSoundCommand } from "./spawn";
import type { SoundPlayer } from "./types";

/**
 * Formats one normalized volume value to PulseAudio's 0-65536 integer scale.
 */
function formatPulseVolume(volume: number): string {
  if (!Number.isFinite(volume)) {
    return "65536";
  }

  if (volume <= 0) {
    return "0";
  }

  if (volume >= 1) {
    return "65536";
  }

  return String(Math.round(volume * 65536));
}

/**
 * Creates one Linux player implementation with paplay primary and aplay fallback.
 */
export function createLinuxSoundPlayer(): SoundPlayer {
  return {
    async play({ filePath, volume }): Promise<void> {
      try {
        await runSoundCommand(["paplay", `--volume=${formatPulseVolume(volume)}`, filePath]);
        return;
      } catch {
        await runSoundCommand(["aplay", filePath]);
      }
    },
  };
}
