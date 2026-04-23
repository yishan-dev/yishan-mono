import { Box, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import { authStore } from "../../store/authStore";
import { LoginView } from "../LoginView";
import { WorkspaceView } from "../WorkspaceView";

const WORKSPACE_ROUTE = "/";

/** Renders one full-screen fallback for unsupported app routes with a route back action. */
export function NotFoundRouteView() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <Stack spacing={1.5} alignItems="center" sx={{ textAlign: "center", maxWidth: 420 }}>
        <Typography variant="h6">{t("routing.notFound.title")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("routing.notFound.description")}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => {
            navigate(WORKSPACE_ROUTE);
          }}
        >
          {t("routing.notFound.backToWorkspace")}
        </Button>
      </Stack>
    </Box>
  );
}

/**
 * Renders the workspace view with an outlet slot for route overlays.
 */
export function ApplicationRouterView() {
  const isAuthenticated = authStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <Box sx={{ height: "100%", position: "relative" }}>
      <WorkspaceView />
      <Outlet />
    </Box>
  );
}
