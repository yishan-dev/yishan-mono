/**
 * Wrapper around electron-builder that injects the correct app version.
 *
 * Version resolution order:
 *   1. YISHAN_APP_VERSION env var  (set by CI or manual override)
 *   2. apps/desktop/package.json "version" field  (fallback)
 *
 * Any additional CLI arguments are forwarded to electron-builder.
 *
 * Usage:
 *   node scripts/packageApp.mjs [--dir] [--publish never]
 *   YISHAN_APP_VERSION=1.2.3 node scripts/packageApp.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const packageJson = JSON.parse(readFileSync(resolve(desktopDir, "package.json"), "utf8"));

const version =
  process.env.YISHAN_APP_VERSION?.trim() ||
  (typeof packageJson.version === "string" ? packageJson.version.trim() : "") ||
  "0.0.0";

console.log(`Packaging app with version: ${version}`);

const extraArgs = process.argv.slice(2);

const args = [
  "electron-builder",
  "-c.extraMetadata.version=" + version,
  ...extraArgs,
];

const result = spawnSync("bunx", args, {
  cwd: desktopDir,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
