import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SOUNDS_DIRECTORY = "notification-sounds";

/** Resolves one desktop sound directory using packaged and development fallback candidates. */
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
    resolve(resourceDirectory, "app", "src", "assets", SOUNDS_DIRECTORY),
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
