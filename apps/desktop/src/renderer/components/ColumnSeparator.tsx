import { Box } from "@mui/material";
import { useCallback, useRef, useState } from "react";

type ColumnSeparatorProps = {
  ariaLabel: string;
  baseWidth?: string;
  hoverWidth?: string;
  onResizeStart: (clientX: number) => void;
  onResizeMove?: (clientX: number) => void;
  onResizeEnd?: () => void;
};

/**
 * Draggable column separator that uses pointer capture to ensure reliable
 * resize behaviour even when the cursor passes over `-webkit-app-region: drag`
 * zones (which swallow regular mouse events in production Electron builds).
 */
export function ColumnSeparator({
  ariaLabel,
  baseWidth = "3px",
  hoverWidth = "3px",
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: ColumnSeparatorProps) {
  const [dragging, setDragging] = useState(false);
  const separatorRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Only handle primary button (left click)
      if (event.button !== 0) return;

      event.preventDefault();
      setDragging(true);

      // Capture the pointer so all subsequent pointer events are routed
      // directly to this element, bypassing -webkit-app-region: drag zones.
      event.currentTarget.setPointerCapture(event.pointerId);

      onResizeStart(event.clientX);
    },
    [onResizeStart],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      onResizeMove?.(event.clientX);
    },
    [dragging, onResizeMove],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;

      setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      onResizeEnd?.();
    },
    [dragging, onResizeEnd],
  );

  return (
    <Box
      ref={separatorRef}
      role="separator"
      aria-label={ariaLabel}
      className="electron-webkit-app-region-no-drag"
      data-dragging={dragging ? "true" : "false"}
      sx={{
        width: baseWidth,
        minWidth: baseWidth,
        height: "100%",
        flexShrink: 0,
        cursor: "col-resize",
        borderRadius: 999,
        position: "relative",
        overflow: "visible",
        bgcolor: "transparent",
        touchAction: "none",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "1px",
          bgcolor: "divider",
          opacity: 0.55,
          pointerEvents: "none",
        },
        "&::after": {
          content: '""',
          position: "absolute",
          top: 0,
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: hoverWidth,
          borderRadius: 999,
          bgcolor: "primary.main",
          opacity: 0,
          transition: "opacity 120ms ease",
          pointerEvents: "none",
        },
        "&:hover": {
          "&::after": {
            opacity: 0.35,
          },
        },
        '&[data-dragging="true"]': {
          "&::after": {
            opacity: 0.8,
          },
        },
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
