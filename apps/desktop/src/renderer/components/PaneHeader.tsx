import { Box } from "@mui/material";
import type { ReactNode } from "react";

/**
 * Shared pane header styling constants used across workspace pane headers.
 *
 * @example
 * ```tsx
 * <PaneHeader>
 *   <IconButton size="small">...</IconButton>
 *   <Typography variant="body2">Title</Typography>
 * </PaneHeader>
 * ```
 */
export const PANE_HEADER_MIN_HEIGHT = 42;

export type PaneHeaderProps = {
  children: ReactNode;
  /** Additional CSS class names applied to the root element. */
  className?: string;
  /** Override the default `justifyContent` value ("space-between"). */
  justifyContent?: "space-between" | "flex-start" | "flex-end" | "center";
  /** Extra padding-y override. Defaults to 0. */
  py?: number;
  /** Optional data-testid attribute for testing. */
  "data-testid"?: string;
};

/**
 * Renders one standardized pane header bar used across workspace left, right, and main panes.
 *
 * Provides the consistent 42px minimum height, horizontal padding, bottom border,
 * `background.paper` fill, and flex alignment that was previously duplicated in
 * `LeftPaneView`, `RightPaneView`, and `MainPaneTitleBarView` as `paneHeaderSx`.
 */
export function PaneHeader({
  children,
  className,
  justifyContent = "space-between",
  py = 0,
  "data-testid": dataTestId,
}: PaneHeaderProps) {
  return (
    <Box
      component="header"
      className={className}
      data-testid={dataTestId}
      sx={{
        minHeight: PANE_HEADER_MIN_HEIGHT,
        px: 1.5,
        py,
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        alignItems: "center",
        justifyContent,
      }}
    >
      {children}
    </Box>
  );
}
