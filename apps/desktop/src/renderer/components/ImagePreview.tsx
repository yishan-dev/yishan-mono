import { Box, Typography } from "@mui/material";
import { getFileName } from "../store/tabs";

type ImagePreviewProps = {
  path: string;
  dataUrl: string;
};

/** Renders a centered, fit-to-view image preview for binary image file tabs. */
export function ImagePreview({ path, dataUrl }: ImagePreviewProps) {
  const fileName = getFileName(path);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          p: 2,
          // Subtle checkerboard to visualize transparent images
          backgroundImage:
            "linear-gradient(45deg, #80808020 25%, transparent 25%), " +
            "linear-gradient(-45deg, #80808020 25%, transparent 25%), " +
            "linear-gradient(45deg, transparent 75%, #80808020 75%), " +
            "linear-gradient(-45deg, transparent 75%, #80808020 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
      >
        <Box
          component="img"
          src={dataUrl}
          alt={fileName}
          sx={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 1.5,
          py: 0.5,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {path}
        </Typography>
      </Box>
    </Box>
  );
}
