import type { DragEvent, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { Terminal } from "@xterm/xterm";
import {
  FILETREE_DRAG_MIME,
  extractSourcePathsFromDataTransfer,
  hasExternalFileDragIntent,
} from "../../../components/FileTree/dataTransfer";
import { escapePathsForShell } from "./terminalPathEscape";

type UseTerminalFileDropOptions = {
  /** Ref to the container element that receives drag events. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Ref to the xterm Terminal instance. */
  xtermRef: RefObject<Terminal | null>;
  /** Ref to the active session id — drop is only handled when a session is active. */
  sessionIdRef: RefObject<string | null>;
};

/**
 * Returns true when the drag payload contains an internal file-tree drag
 * (identified by the custom {@link FILETREE_DRAG_MIME} type).
 */
function hasFileTreeDragIntent(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes(FILETREE_DRAG_MIME);
}

/**
 * Extracts absolute file paths from an internal file-tree drag payload.
 * Returns an empty array when the payload is missing or malformed.
 */
function extractFileTreeDragPaths(dataTransfer: DataTransfer): string[] {
  const raw = dataTransfer.getData(FILETREE_DRAG_MIME);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

/**
 * Returns true when a drag event carries either an internal file-tree drag
 * or an external OS file drag that the terminal should accept.
 */
function isAcceptableFileDrag(event: globalThis.DragEvent): boolean {
  if (!event.dataTransfer) {
    return false;
  }

  if (hasFileTreeDragIntent(event.dataTransfer)) {
    return true;
  }

  // Fall back to the external-file heuristic used by the FileTree component.
  const reactishEvent = event as unknown as DragEvent<HTMLElement>;
  return hasExternalFileDragIntent(reactishEvent);
}

/**
 * Extracts file paths from a drop event, handling both internal file-tree
 * drags and external OS file drops.
 */
function extractDroppedPaths(dataTransfer: DataTransfer): string[] {
  // Internal file-tree drag takes priority — its paths are already absolute.
  const fileTreePaths = extractFileTreeDragPaths(dataTransfer);
  if (fileTreePaths.length > 0) {
    return fileTreePaths;
  }

  // Fall back to external OS file extraction.
  return extractSourcePathsFromDataTransfer(dataTransfer);
}

/**
 * Attaches drag-and-drop event listeners to one terminal container so that
 * dropping files — either from the internal file tree or from the OS — inserts
 * their shell-escaped paths at the current cursor position.
 *
 * Design decisions:
 * - Uses native DOM listeners (not React synthetic events) because xterm
 *   already captures pointer/keyboard events on its own canvas and React
 *   synthetic drag events can interfere with xterm's internal handling.
 * - Prevents default on dragover/dragenter so the browser accepts the drop.
 * - Uses `terminal.paste()` which writes text into the terminal input buffer
 *   and triggers `onData`, which sends it to the PTY — consistent with how
 *   clipboard paste and Shift+Enter already work in TerminalView.
 * - Multiple files are space-separated, each independently escaped.
 */
export function useTerminalFileDrop({ containerRef, xtermRef, sessionIdRef }: UseTerminalFileDropOptions): void {
  const isDragOverRef = useRef(false);

  const handleDragOver = useCallback((event: globalThis.DragEvent) => {
    if (!isAcceptableFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    isDragOverRef.current = true;
  }, []);

  const handleDragEnter = useCallback((event: globalThis.DragEvent) => {
    if (!isAcceptableFileDrag(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((_event: globalThis.DragEvent) => {
    isDragOverRef.current = false;
  }, []);

  const handleDrop = useCallback(
    (event: globalThis.DragEvent) => {
      isDragOverRef.current = false;

      const terminal = xtermRef.current;
      const sessionId = sessionIdRef.current;
      if (!terminal || !sessionId || !event.dataTransfer) {
        return;
      }

      if (!isAcceptableFileDrag(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const paths = extractDroppedPaths(event.dataTransfer);
      if (paths.length === 0) {
        return;
      }

      const escapedText = escapePathsForShell(paths);
      terminal.paste(escapedText);
      terminal.focus();
    },
    [xtermRef, sessionIdRef],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("dragenter", handleDragEnter);
    container.addEventListener("dragleave", handleDragLeave);
    container.addEventListener("drop", handleDrop);

    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("dragenter", handleDragEnter);
      container.removeEventListener("dragleave", handleDragLeave);
      container.removeEventListener("drop", handleDrop);
    };
  }, [containerRef, handleDragOver, handleDragEnter, handleDragLeave, handleDrop]);
}
