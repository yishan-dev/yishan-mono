import { Box, Typography } from "@mui/material";

type UnsupportedFileViewProps = {
  path: string;
  title: string;
  description: string;
  hint?: string;
};

/** Renders one centered empty-state for unsupported editor file types. */
export function UnsupportedFileView({ path, title, description, hint }: UnsupportedFileViewProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        px: 3,
        textAlign: "center",
      }}
    >
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
      <Typography variant="caption" color="text.disabled">
        {path}
      </Typography>
    </Box>
  );
}
