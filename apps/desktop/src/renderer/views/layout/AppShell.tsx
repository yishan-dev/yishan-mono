import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useShortcuts } from "../../hooks/useShortcuts";

/** Renders the app frame and route content. */
export function AppShell() {
  useShortcuts();

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        display: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
        color: "text.primary",
        boxSizing: "border-box",
        flex: 1,
      }}
    >
        <Outlet />
    </Box>
  );
}
