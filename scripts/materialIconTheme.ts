export type IconThemeManifest = {
  iconDefinitions: Record<string, { iconPath: string }>;
  file: string;
  folder: string;
  folderExpanded: string;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  languageIds?: Record<string, string>;
};

export const CURATED_LANGUAGE_ID_EXTENSION_ALIASES: Record<string, string[]> = {
  html: ["html"],
  javascript: ["js", "cjs"],
  php: ["php"],
  tex: ["tex"],
  typescript: ["ts", "cts", "mts"],
  yaml: ["yaml", "yml"],
};

/** Looks up one icon id by exact key with case-insensitive fallback. */
function lookupIconId(map: Record<string, string>, key: string): string | undefined {
  return map[key] ?? map[key.toLowerCase()];
}

/**
 * Builds the file-extension map used by the desktop file tree.
 *
 * Material Icon Theme keeps some common defaults under `languageIds` instead of
 * `fileExtensions`. Since the desktop app resolves icons from filenames only,
 * we merge a small set of canonical extension aliases back into the generated map.
 */
export function buildMaterialFileExtensions(
  manifest: Pick<IconThemeManifest, "fileExtensions" | "languageIds">,
): Record<string, string> {
  const fileExtensions = { ...manifest.fileExtensions };

  for (const [languageId, aliases] of Object.entries(CURATED_LANGUAGE_ID_EXTENSION_ALIASES)) {
    const iconId = manifest.languageIds?.[languageId];
    if (!iconId) {
      continue;
    }

    for (const alias of aliases) {
      fileExtensions[alias] ??= iconId;
    }
  }

  return fileExtensions;
}

/** Resolves the icon id for one filename using the same filename/extension rules as the desktop app. */
export function resolveMaterialFileIconId(
  fileName: string,
  manifest: Pick<IconThemeManifest, "file" | "fileNames" | "fileExtensions" | "languageIds">,
): string {
  const byName = lookupIconId(manifest.fileNames, fileName);
  if (byName) {
    return byName;
  }

  const fileExtensions = buildMaterialFileExtensions(manifest);
  const parts = fileName.split(".");

  if (parts.length > 1) {
    for (let index = 1; index < parts.length; index += 1) {
      const extension = parts.slice(index).join(".");
      const byExtension = lookupIconId(fileExtensions, extension);

      if (byExtension) {
        return byExtension;
      }
    }
  }

  return manifest.file;
}

/** Reports curated aliases that still have no icon coverage after the merge step. */
export function findMissingMaterialExtensionAliases(
  manifest: Pick<IconThemeManifest, "fileExtensions" | "languageIds">,
): Array<{ languageId: string; extension: string }> {
  const fileExtensions = buildMaterialFileExtensions(manifest);
  const missingAliases: Array<{ languageId: string; extension: string }> = [];

  for (const [languageId, aliases] of Object.entries(CURATED_LANGUAGE_ID_EXTENSION_ALIASES)) {
    for (const extension of aliases) {
      if (!lookupIconId(fileExtensions, extension)) {
        missingAliases.push({ languageId, extension });
      }
    }
  }

  return missingAliases;
}
