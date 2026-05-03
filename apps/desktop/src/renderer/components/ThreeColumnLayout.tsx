import { Box } from "@mui/material";
import type { ReactNode, RefObject } from "react";
import { ColumnSeparator } from "./ColumnSeparator";

export const THREE_COL_GAP_PX = 0;
export const THREE_COL_SPLITTER_PX = "16px";

type ThreeColumnLayoutProps = {
  layoutRef?: RefObject<HTMLDivElement | null>;
  left: ReactNode;
  main: ReactNode;
  right: ReactNode;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftResizeLabel: string;
  rightResizeLabel: string;
  onResizeLeftStart: (clientX: number) => void;
  onResizeLeftMove?: (clientX: number) => void;
  onResizeLeftEnd?: () => void;
  onResizeRightStart: (clientX: number) => void;
  onResizeRightMove?: (clientX: number) => void;
  onResizeRightEnd?: () => void;
};

/**
 * Renders the workspace three-column shell while hiding collapsed side panes without unmounting them.
 */
export function ThreeColumnLayout({
  layoutRef,
  left,
  main,
  right,
  leftCollapsed,
  rightCollapsed,
  leftResizeLabel,
  rightResizeLabel,
  onResizeLeftStart,
  onResizeLeftMove,
  onResizeLeftEnd,
  onResizeRightStart,
  onResizeRightMove,
  onResizeRightEnd,
}: ThreeColumnLayoutProps) {
  return (
    <Box
      ref={layoutRef}
      sx={{
        display: "flex",
        alignItems: "stretch",
        gap: `${THREE_COL_GAP_PX}px`,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <Box sx={{ display: leftCollapsed ? "none" : "block", minWidth: 0 }}>{left}</Box>
      <Box sx={{ display: leftCollapsed ? "none" : "block" }}>
        <ColumnSeparator ariaLabel={leftResizeLabel} onResizeStart={onResizeLeftStart} onResizeMove={onResizeLeftMove} onResizeEnd={onResizeLeftEnd} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>{main}</Box>

      <Box sx={{ display: rightCollapsed ? "none" : "block" }}>
        <ColumnSeparator ariaLabel={rightResizeLabel} onResizeStart={onResizeRightStart} onResizeMove={onResizeRightMove} onResizeEnd={onResizeRightEnd} />
      </Box>
      <Box sx={{ display: rightCollapsed ? "none" : "block", minWidth: 0 }}>{right}</Box>
    </Box>
  );
}
