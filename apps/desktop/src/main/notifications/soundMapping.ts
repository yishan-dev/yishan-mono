import { join } from "node:path";
import type { NotificationSoundId } from "../../shared/notifications/notificationPreferences";

const SOUND_FILES: Record<NotificationSoundId, string> = {
  chime: "ding-dong.wav",
  ping: "three-note.wav",
  pop: "piano-notification.wav",
  zip: "zip.wav",
  alert: "bleep-descending.wav",
};

/** Resolves one sound id into an absolute audio file path using one directory root. */
export function resolveSoundFilePath(input: {
  soundDirectoryPath: string;
  soundId: NotificationSoundId;
}): string {
  const fileName = SOUND_FILES[input.soundId];
  if (input.soundDirectoryPath.includes("\\")) {
    return `${input.soundDirectoryPath.replace(/[\\/]$/, "")}\\${fileName}`;
  }

  return join(input.soundDirectoryPath, fileName);
}
