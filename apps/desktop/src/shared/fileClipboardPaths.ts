/** Extracts file-system absolute paths from one newline-separated URI list payload. */
export function extractPathsFromUriList(rawValue: string): string[] {
  return rawValue
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !line.startsWith("#"))
    .flatMap((line) => {
      if (!line.startsWith("file://")) {
        return [];
      }

      try {
        const parsedUrl = new URL(line);
        const decodedPath = decodeURIComponent(parsedUrl.pathname);
        const normalizedHost = parsedUrl.host.trim().toLowerCase();
        if (normalizedHost && normalizedHost !== "localhost") {
          return [`//${parsedUrl.host}${decodedPath}`];
        }

        const normalizedPath = decodedPath.replace(/^\/([A-Za-z]:\/)/, "$1");
        return normalizedPath ? [normalizedPath] : [];
      } catch {
        return [];
      }
    });
}

/** Extracts absolute file-system paths from plain text payload lines. */
export function extractPathsFromPlainText(rawValue: string): string[] {
  return rawValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const withoutQuotes =
        (line.startsWith('"') && line.endsWith('"')) || (line.startsWith("'") && line.endsWith("'"))
          ? line.slice(1, -1)
          : line;
      return withoutQuotes.trim();
    })
    .filter((line) => {
      const normalized = line.replace(/\\/g, "/");
      const isUnixAbsolutePath = normalized.startsWith("/");
      const isWindowsAbsolutePath = /^[A-Za-z]:\//.test(normalized);
      return isUnixAbsolutePath || isWindowsAbsolutePath;
    });
}

/** Extracts absolute paths from one arbitrary clipboard text payload. */
export function extractPathsFromClipboardText(rawValue: string): string[] {
  const uriPaths = extractPathsFromUriList(rawValue);
  const plainTextPaths = extractPathsFromPlainText(rawValue);
  return [...new Set([...uriPaths, ...plainTextPaths])];
}
