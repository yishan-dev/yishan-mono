import type { DragEvent } from "react";
import { extractPathsFromClipboardText } from "../../../shared/fileClipboardPaths";

/** Returns true when drag metadata indicates one or more filesystem entries are included. */
export function hasExternalFileDragIntent(event: DragEvent<HTMLElement>): boolean {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return false;
  }

  if (dataTransfer.files.length > 0) {
    return true;
  }

  const hasFileItems = Array.from(dataTransfer.items).some((item) => item.kind === "file");
  if (hasFileItems) {
    return true;
  }

  const payloadTypes = new Set([...(dataTransfer.types ?? [])].map((value) => value.toLowerCase()));
  if (payloadTypes.has("files")) {
    return true;
  }

  return [...payloadTypes].some((type) => type.includes("file") || type.includes("uri"));
}

/** Extracts absolute filesystem paths from one sync drag/drop/clipboard payload. */
export function extractSourcePathsFromDataTransfer(dataTransfer: DataTransfer): string[] {
  const getData = (type: string): string => {
    if (typeof dataTransfer.getData !== "function") {
      return "";
    }

    return dataTransfer.getData(type) || "";
  };

  const filePaths = Array.from(dataTransfer.files)
    .map((file) => (file as File & { path?: string }).path?.trim() ?? "")
    .filter(Boolean);
  const itemPaths = Array.from(dataTransfer.items)
    .map((item) => item.getAsFile())
    .map((file) => (file as (File & { path?: string }) | null)?.path?.trim() ?? "")
    .filter(Boolean);
  const uriListPaths = extractPathsFromClipboardText(getData("text/uri-list"));
  const textPlainPaths = extractPathsFromClipboardText(getData("text/plain"));

  return [...new Set([...filePaths, ...itemPaths, ...uriListPaths, ...textPlainPaths])];
}

/** Reads one data-transfer item as string and returns empty text when unsupported. */
async function readDataTransferItemAsString(item: DataTransferItem): Promise<string> {
  if (typeof item.getAsString !== "function") {
    return "";
  }

  return new Promise<string>((resolve) => {
    try {
      item.getAsString((value) => {
        resolve(value ?? "");
      });
    } catch {
      resolve("");
    }
  });
}

/** Extracts absolute filesystem paths from sync and async data-transfer sources. */
export async function extractSourcePathsFromDataTransferAsync(dataTransfer: DataTransfer): Promise<string[]> {
  const sourcePathSet = new Set(extractSourcePathsFromDataTransfer(dataTransfer));
  const clipboardItems = Array.from(dataTransfer.items ?? []);

  for (const item of clipboardItems) {
    if (item.kind !== "string") {
      continue;
    }

    const normalizedType = item.type.toLowerCase();
    const shouldReadTextPayload =
      normalizedType.startsWith("text/") || normalizedType.includes("uri") || normalizedType.includes("file-url");
    if (!shouldReadTextPayload) {
      continue;
    }

    const value = await readDataTransferItemAsString(item);
    if (!value.trim()) {
      continue;
    }

    for (const path of extractPathsFromClipboardText(value)) {
      sourcePathSet.add(path);
    }
  }

  return [...sourcePathSet];
}
