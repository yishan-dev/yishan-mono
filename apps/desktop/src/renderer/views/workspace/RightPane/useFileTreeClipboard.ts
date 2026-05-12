import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ExternalClipboardReadOutcome, WorkspaceFileEntry } from "../../../../shared/contracts/rpcRequestTypes";
import { extractPathsFromClipboardText } from "../../../../shared/fileClipboardPaths";
import {
  importEntries,
  importFilePayloads,
  pasteEntries,
  readExternalClipboardSourcePaths as readExternalClipboardSourcePathsFromRpc,
} from "../../../commands/fileCommands";
import {
  DEFAULT_CLIPBOARD_SOURCE_RESOLVERS,
  type FileTreeClipboardState,
  resolveClipboardSource,
} from "./clipboardSourceResolvers";
import {
  type FileTreeMoveUndoEntry,
  buildMoveUndoEntries,
  resolvePreferredImportedPath,
} from "./fileTreePathHelpers";
import {
  mapWorkspaceEntryPaths,
  reportNativeExternalClipboardOutcome,
  resolveExternalClipboardFilePayloads,
} from "./fileTreeHelpers";
import type { FileTreeUndoAction } from "./useFileTreeUndo";

type UseFileTreeClipboardInput = {
  selectedWorkspaceWorktreePath: string | undefined;
  repoEntries: WorkspaceFileEntry[];
  clipboardState: FileTreeClipboardState | null;
  setClipboardState: React.Dispatch<React.SetStateAction<FileTreeClipboardState | null>>;
  loadAllRepoFiles: () => Promise<string[]>;
  pushUndoAction: (action: FileTreeUndoAction) => void;
  requestFileTreeSelection: (path: string | null, focus?: boolean) => void;
  beginFileOperation: (mode: "copy" | "move" | "import") => string;
  completeFileOperation: (operationId: string) => void;
  failFileOperation: (operationId: string, error: unknown) => void;
  setFileOperationError: (error: string | null) => void;
};

export function useFileTreeClipboard({
  selectedWorkspaceWorktreePath,
  repoEntries,
  clipboardState,
  setClipboardState,
  loadAllRepoFiles,
  pushUndoAction,
  requestFileTreeSelection,
  beginFileOperation,
  completeFileOperation,
  failFileOperation,
  setFileOperationError,
}: UseFileTreeClipboardInput) {
  const { t } = useTranslation();
  const isExternalImportInFlightRef = useRef(false);
  const clipboardStateRequestIdRef = useRef(0);

  const beginExternalImportLock = useCallback((): boolean => {
    if (isExternalImportInFlightRef.current) {
      return false;
    }

    isExternalImportInFlightRef.current = true;
    return true;
  }, []);

  const endExternalImportLock = useCallback((): void => {
    isExternalImportInFlightRef.current = false;
  }, []);

  const captureNativeExternalClipboardSourcePathsSnapshot = useCallback(async (): Promise<string[] | null> => {
    try {
      const nativeClipboardResult = await readExternalClipboardSourcePathsFromRpc();
      reportNativeExternalClipboardOutcome(nativeClipboardResult);
      if (nativeClipboardResult.kind === "success") {
        return nativeClipboardResult.sourcePaths;
      }

      if (nativeClipboardResult.kind === "supported" || nativeClipboardResult.kind === "empty") {
        return [];
      }

      return null;
    } catch (error) {
      console.warn("Failed to capture native clipboard snapshot for internal file-tree clipboard", error);
      return null;
    }
  }, []);

  const setInternalClipboardState = useCallback(
    (mode: "copy" | "move", path: string): void => {
      clipboardStateRequestIdRef.current += 1;
      const requestId = clipboardStateRequestIdRef.current;
      setClipboardState({
        requestId,
        mode,
        sourcePaths: [path],
        externalClipboardSnapshotSourcePaths: null,
      });

      void (async () => {
        const externalClipboardSnapshotSourcePaths = await captureNativeExternalClipboardSourcePathsSnapshot();
        setClipboardState((currentState) => {
          if (!currentState || currentState.requestId !== requestId) {
            return currentState;
          }

          return {
            ...currentState,
            externalClipboardSnapshotSourcePaths,
          };
        });
      })();
    },
    [captureNativeExternalClipboardSourcePathsSnapshot, setClipboardState],
  );

  const resolveExternalClipboardSourcePaths = useCallback(async (): Promise<{
    sourcePaths: string[];
    nativeOutcome: ExternalClipboardReadOutcome | null;
  }> => {
    const sourcePathSet = new Set<string>();
    let nativeOutcome: ExternalClipboardReadOutcome | null = null;

    try {
      nativeOutcome = await readExternalClipboardSourcePathsFromRpc();
      reportNativeExternalClipboardOutcome(nativeOutcome);
      if (nativeOutcome.kind === "success") {
        for (const sourcePath of nativeOutcome.sourcePaths) {
          sourcePathSet.add(sourcePath);
        }
      }
    } catch (error) {
      console.warn("Failed to read native clipboard paths for external file paste", error);
    }

    if (sourcePathSet.size > 0) {
      return {
        sourcePaths: [...sourcePathSet],
        nativeOutcome,
      };
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return {
        sourcePaths: [],
        nativeOutcome,
      };
    }

    if (typeof navigator.clipboard.read === "function") {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            const normalizedType = type.toLowerCase();
            const shouldAttemptTextExtraction =
              normalizedType.startsWith("text/") ||
              normalizedType.includes("uri") ||
              normalizedType.includes("file-url") ||
              normalizedType.includes("utf8-plain-text");
            if (!shouldAttemptTextExtraction) {
              continue;
            }

            const blob = await clipboardItem.getType(type);
            const text = await blob.text();
            const paths = extractPathsFromClipboardText(text);
            for (const path of paths) {
              sourcePathSet.add(path);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to read clipboard items for external file paste", error);
      }
    }

    if (sourcePathSet.size === 0 && typeof navigator.clipboard.readText === "function") {
      try {
        const text = await navigator.clipboard.readText();
        const paths = extractPathsFromClipboardText(text);
        for (const path of paths) {
          sourcePathSet.add(path);
        }
      } catch (error) {
        console.warn("Failed to read clipboard text for external file paste", error);
      }
    }

    return {
      sourcePaths: [...sourcePathSet],
      nativeOutcome,
    };
  }, []);

  const onPasteEntries = useCallback(
    async (destinationPath: string) => {
      if (!selectedWorkspaceWorktreePath) {
        return;
      }

      const repoFilesBeforePaste = mapWorkspaceEntryPaths(repoEntries);
      const skipExternalPathRead = clipboardState?.mode === "move";
      const externalClipboardSourcePathResult = skipExternalPathRead
        ? { sourcePaths: [], nativeOutcome: null }
        : await resolveExternalClipboardSourcePaths();
      const { nativeOutcome } = externalClipboardSourcePathResult;
      const externalSourcePaths = externalClipboardSourcePathResult.sourcePaths;
      const externalFilePayloads =
        skipExternalPathRead || externalSourcePaths.length > 0 ? [] : await resolveExternalClipboardFilePayloads();

      const shouldSetExternalClipboardError =
        !skipExternalPathRead &&
        !clipboardState &&
        externalSourcePaths.length === 0 &&
        externalFilePayloads.length === 0 &&
        nativeOutcome &&
        (nativeOutcome.kind === "permission-denied" || nativeOutcome.kind === "parse-failed");

      if (shouldSetExternalClipboardError && nativeOutcome) {
        setFileOperationError(
          nativeOutcome.kind === "permission-denied" ? t("files.operations.failed") : nativeOutcome.message,
        );
      }

      const resolvedClipboardSource = resolveClipboardSource(
        {
          clipboardState,
          externalSourcePaths,
          externalFilePayloads,
        },
        DEFAULT_CLIPBOARD_SOURCE_RESOLVERS,
      );

      if (!resolvedClipboardSource) {
        return;
      }

      if (resolvedClipboardSource.kind === "external-paths") {
        if (!beginExternalImportLock()) {
          return;
        }

        const operationId = beginFileOperation("import");

        try {
          await importEntries({
            workspaceWorktreePath: selectedWorkspaceWorktreePath,
            sourcePaths: resolvedClipboardSource.sourcePaths,
            destinationRelativePath: destinationPath,
          });
          completeFileOperation(operationId);

          await loadAllRepoFiles();
          const nextRepoFiles = await loadAllRepoFiles();
          requestFileTreeSelection(
            resolvePreferredImportedPath(
              repoFilesBeforePaste,
              nextRepoFiles,
              destinationPath,
              resolvedClipboardSource.sourcePaths,
            ),
          );
        } catch (error) {
          failFileOperation(operationId, error);
          console.error("Failed to import pasted external workspace entries", error);
        } finally {
          endExternalImportLock();
        }
        return;
      }

      if (resolvedClipboardSource.kind === "external-file-payloads") {
        if (!beginExternalImportLock()) {
          return;
        }

        const operationId = beginFileOperation("import");

        try {
          await importFilePayloads({
            workspaceWorktreePath: selectedWorkspaceWorktreePath,
            filePayloads: resolvedClipboardSource.filePayloads,
            destinationRelativePath: destinationPath,
          });
          completeFileOperation(operationId);

          await loadAllRepoFiles();
          const nextRepoFiles = await loadAllRepoFiles();
          requestFileTreeSelection(
            resolvePreferredImportedPath(
              repoFilesBeforePaste,
              nextRepoFiles,
              destinationPath,
              resolvedClipboardSource.filePayloads.map((filePayload) => filePayload.relativePath),
            ),
          );
        } catch (error) {
          failFileOperation(operationId, error);
          console.error("Failed to import pasted external workspace file payloads", error);
        } finally {
          endExternalImportLock();
        }
        return;
      }

      const moveUndoEntries =
        resolvedClipboardSource.mode === "move"
          ? buildMoveUndoEntries(repoFilesBeforePaste, resolvedClipboardSource.sourcePaths, destinationPath)
          : [];
      const operationId = beginFileOperation(resolvedClipboardSource.mode);

      try {
        await pasteEntries({
          workspaceWorktreePath: selectedWorkspaceWorktreePath,
          sourceRelativePaths: resolvedClipboardSource.sourcePaths,
          destinationRelativePath: destinationPath,
          mode: resolvedClipboardSource.mode,
        });
        completeFileOperation(operationId);

        await loadAllRepoFiles();
        const nextRepoFiles = await loadAllRepoFiles();
        requestFileTreeSelection(
          resolvePreferredImportedPath(
            repoFilesBeforePaste,
            nextRepoFiles,
            destinationPath,
            resolvedClipboardSource.sourcePaths,
          ),
        );

        if (resolvedClipboardSource.mode === "move") {
          if (moveUndoEntries.length > 0) {
            pushUndoAction({
              kind: "move",
              entries: moveUndoEntries,
            });
          }
          setClipboardState(null);
        }
      } catch (error) {
        failFileOperation(operationId, error);
        console.error("Failed to paste workspace entries", error);
      }
    },
    [
      beginExternalImportLock,
      beginFileOperation,
      clipboardState,
      completeFileOperation,
      endExternalImportLock,
      failFileOperation,
      loadAllRepoFiles,
      pushUndoAction,
      repoEntries,
      requestFileTreeSelection,
      resolveExternalClipboardSourcePaths,
      selectedWorkspaceWorktreePath,
      setClipboardState,
      setFileOperationError,
      t,
    ],
  );

  const onDropExternalEntries = useCallback(
    async (sourcePaths: string[], destinationPath: string) => {
      if (!selectedWorkspaceWorktreePath) {
        return;
      }

      const repoFilesBeforeDropImport = mapWorkspaceEntryPaths(repoEntries);
      if (!beginExternalImportLock()) {
        return;
      }

      const operationId = beginFileOperation("import");

      try {
        await importEntries({
          workspaceWorktreePath: selectedWorkspaceWorktreePath,
          sourcePaths,
          destinationRelativePath: destinationPath,
        });
        completeFileOperation(operationId);

        await loadAllRepoFiles();
        const nextRepoFiles = await loadAllRepoFiles();
        requestFileTreeSelection(
          resolvePreferredImportedPath(repoFilesBeforeDropImport, nextRepoFiles, destinationPath, sourcePaths),
        );
      } catch (error) {
        failFileOperation(operationId, error);
        console.error("Failed to import dropped workspace entries", error);
      } finally {
        endExternalImportLock();
      }
    },
    [
      beginExternalImportLock,
      beginFileOperation,
      completeFileOperation,
      endExternalImportLock,
      failFileOperation,
      loadAllRepoFiles,
      repoEntries,
      requestFileTreeSelection,
      selectedWorkspaceWorktreePath,
    ],
  );

  return {
    setInternalClipboardState,
    onPasteEntries,
    onDropExternalEntries,
  };
}
