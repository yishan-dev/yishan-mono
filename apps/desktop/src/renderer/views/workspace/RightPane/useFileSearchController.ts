import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { searchFiles } from "../../../search/fileSearch";

const MAX_FILE_SEARCH_RESULTS = 100;

type UseFileSearchControllerInput = {
  searchableFiles: string[];
  loadAllRepoFiles: () => Promise<unknown>;
  openFileSearchRequestKey: number;
  lastHandledFileSearchRequestKey: number;
  onFileSearchRequestHandled?: (requestKey: number) => void;
  openSearchResult: (path: string) => Promise<void>;
};

/** Manages quick-open file search state, filtering, keyboard navigation, and open actions. */
export function useFileSearchController({
  searchableFiles,
  loadAllRepoFiles,
  openFileSearchRequestKey,
  lastHandledFileSearchRequestKey,
  onFileSearchRequestHandled,
  openSearchResult,
}: UseFileSearchControllerInput) {
  const [isFileSearchOpen, setIsFileSearchOpen] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [selectedSearchResultIndex, setSelectedSearchResultIndex] = useState(0);

  const trimmedFileSearchQuery = fileSearchQuery.trim();
  const deferredFileSearchQuery = useDeferredValue(trimmedFileSearchQuery);
  const fileSearchResults = useMemo(
    () =>
      deferredFileSearchQuery
        ? searchFiles(searchableFiles, deferredFileSearchQuery).slice(0, MAX_FILE_SEARCH_RESULTS)
        : [],
    [deferredFileSearchQuery, searchableFiles],
  );

  useEffect(() => {
    if (openFileSearchRequestKey <= lastHandledFileSearchRequestKey) {
      return;
    }

    setFileSearchQuery("");
    setSelectedSearchResultIndex(0);
    setIsFileSearchOpen(true);
    void loadAllRepoFiles();
    onFileSearchRequestHandled?.(openFileSearchRequestKey);
  }, [lastHandledFileSearchRequestKey, loadAllRepoFiles, onFileSearchRequestHandled, openFileSearchRequestKey]);

  useEffect(() => {
    if (selectedSearchResultIndex < fileSearchResults.length) {
      return;
    }

    setSelectedSearchResultIndex(Math.max(0, fileSearchResults.length - 1));
  }, [fileSearchResults.length, selectedSearchResultIndex]);

  const openSelectedSearchResult = useCallback(async () => {
    const selectedResult = fileSearchResults[selectedSearchResultIndex];
    if (!selectedResult) {
      return;
    }

    await openSearchResult(selectedResult.path);
  }, [fileSearchResults, openSearchResult, selectedSearchResultIndex]);

  const handleFileSearchInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (fileSearchResults.length === 0) {
          return;
        }

        setSelectedSearchResultIndex((current) => Math.min(current + 1, fileSearchResults.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (fileSearchResults.length === 0) {
          return;
        }

        setSelectedSearchResultIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void openSelectedSearchResult();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsFileSearchOpen(false);
      }
    },
    [fileSearchResults.length, openSelectedSearchResult],
  );

  return {
    isFileSearchOpen,
    setIsFileSearchOpen,
    fileSearchQuery,
    setFileSearchQuery,
    selectedSearchResultIndex,
    setSelectedSearchResultIndex,
    fileSearchResults,
    handleFileSearchInputKeyDown,
  };
}
