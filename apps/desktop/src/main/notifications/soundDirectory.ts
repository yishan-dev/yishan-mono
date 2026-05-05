import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SOUNDS_DIRECTORY = "notification-sounds";

/**
 * Resolves one desktop sound directory using packaged and development fallback candidates.
 *
 * In production Electron builds sound files are extracted from the asar archive via
 * `asarUnpack` into `app.asar.unpacked/`.  External OS processes like `afplay` or
 * `paplay` cannot read from inside an asar, so the unpacked path is preferred.
 */
export function resolveDesktopSoundDirectory(input?: {
  platform?: NodeJS.Platform;
  executablePath?: string;
  cwd?: string;
}): string {
  const platform = input?.platform ?? process.platform;
  const executablePath = input?.executablePath ?? process.execPath;
  const cwd = input?.cwd ?? process.cwd();

  const executableDirectory = dirname(executablePath);
  const resourceDirectory =
    platform === "darwin" ? resolve(executableDirectory, "../Resources") : resolve(executableDirectory, "resources");

  const candidates = [
    // Unpacked asar path – used in production because external sound players
    // (afplay, paplay, powershell) cannot read files from inside an asar archive.
    resolve(resourceDirectory, "app.asar.unpacked", "src", "assets", SOUNDS_DIRECTORY),
    // Development paths – used when running from source with `npm run dev`.
    resolve(cwd, "src", "assets", SOUNDS_DIRECTORY),
    resolve(cwd, "apps", "desktop", "src", "assets", SOUNDS_DIRECTORY),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? resolve(resourceDirectory, SOUNDS_DIRECTORY);
}
