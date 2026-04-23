import { localFileSearchProvider } from "./localFileSearchProvider";
import type { FileSearchProvider, FileSearchResult } from "./types";

let activeFileSearchProvider: FileSearchProvider = localFileSearchProvider;

/**
 * Overrides the active renderer-side file search provider.
 */
export function setFileSearchProvider(provider: FileSearchProvider): void {
  activeFileSearchProvider = provider;
}

/**
 * Restores the default local file search provider.
 */
export function resetFileSearchProvider(): void {
  activeFileSearchProvider = localFileSearchProvider;
}

/**
 * Searches files through the active provider boundary.
 */
export function searchFiles(paths: string[], rawQuery: string): FileSearchResult[] {
  return activeFileSearchProvider.searchFiles(paths, rawQuery);
}

export type { FileSearchProvider, FileSearchResult };
