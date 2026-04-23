import { Box } from "@mui/material";
import { useEffect, useState } from "react";

type ColumnSeparatorProps = {
  ariaLabel: string;
  baseWidth?: string;
  hoverWidth?: string;
  onResizeStart: (clientX: number) => void;
};

export function ColumnSeparator({
  ariaLabel,
  baseWidth = "3px",
  hoverWidth = "3px",
  onResizeStart,
}: ColumnSeparatorProps) {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const stopDragging = () => {
      setDragging(false);
    };

    window.addEventListener("mouseup", stopDragging);
    window.addEventListener("blur", stopDragging);
    return () => {
      window.removeEventListener("mouseup", stopDragging);
      window.removeEventListener("blur", stopDragging);
    };
  }, [dragging]);

  return (
    <Box
      role="separator"
      aria-label={ariaLabel}
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
      onMouseDown={(event) => {
        event.preventDefault();
        setDragging(true);
        onResizeStart(event.clientX);
      }}
    />
  );
}
