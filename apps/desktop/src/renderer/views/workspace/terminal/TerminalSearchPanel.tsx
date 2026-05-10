import { IconButton, InputBase, Stack } from "@mui/material";
import type { RefObject } from "react";

type TerminalSearchPanelProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchPrevious: () => void;
  onSearchNext: () => void;
  onClose: () => void;
};

export function TerminalSearchPanel({
  searchInputRef,
  searchQuery,
  onSearchQueryChange,
  onSearchPrevious,
  onSearchNext,
  onClose,
}: TerminalSearchPanelProps) {
  const isSearchDisabled = searchQuery.trim().length === 0;

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        position: "absolute",
        top: 8,
        right: 12,
        alignItems: "center",
        px: 1,
        py: 0.5,
        border: "1px solid #414754",
        borderRadius: 1,
        bgcolor: "#31363f",
        zIndex: 2,
      }}
    >
      <InputBase
        inputRef={searchInputRef}
        value={searchQuery}
        onChange={(event) => {
          onSearchQueryChange(event.target.value);
        }}
        placeholder="Find"
        slotProps={{
          input: {
            "aria-label": "Search terminal output",
          },
        }}
        sx={{
          width: 220,
          px: 0.75,
          py: 0.25,
          border: "1px solid #414754",
          borderRadius: 0.75,
          color: "#e7ebf0",
          fontSize: 13,
        }}
      />
      <IconButton
        aria-label="Previous terminal match"
        size="small"
        disabled={isSearchDisabled}
        onClick={onSearchPrevious}
        sx={{
          color: "#e7ebf0",
          fontSize: 11,
          "&.Mui-disabled": {
            color: "#8b8b8b",
          },
        }}
      >
        Prev
      </IconButton>
      <IconButton
        aria-label="Next terminal match"
        size="small"
        disabled={isSearchDisabled}
        onClick={onSearchNext}
        sx={{
          color: "#e7ebf0",
          fontSize: 11,
          "&.Mui-disabled": {
            color: "#8b8b8b",
          },
        }}
      >
        Next
      </IconButton>
      <IconButton aria-label="Close terminal search" size="small" onClick={onClose} sx={{ color: "#e7ebf0", fontSize: 11 }}>
        Close
      </IconButton>
    </Stack>
  );
}
