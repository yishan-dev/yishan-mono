export type FileSearchResult = {
  path: string;
  score: number;
  highlightedPathIndexes: number[];
};

/**
 * Defines one renderer-side contract for file search providers.
 */
export type FileSearchProvider = {
  searchFiles(paths: string[], rawQuery: string): FileSearchResult[];
};
