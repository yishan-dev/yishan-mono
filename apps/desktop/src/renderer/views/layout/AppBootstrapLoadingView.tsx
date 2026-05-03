import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

type AppBootstrapLoadingViewProps = {
  hasError: boolean;
  onRetry: () => void;
};

export function AppBootstrapLoadingView(props: AppBootstrapLoadingViewProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box
        component="header"
        className="electron-webkit-app-region-drag"
        data-testid="bootstrap-loading-topbar"
        sx={{
          height: 42,
          minHeight: 42,
          px: 1,
          display: "flex",
          alignItems: "center",
        }}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center" sx={{ textAlign: "center", maxWidth: 420 }}>
          <CircularProgress size={28} />
          <Typography variant="h6">{t("app.bootstrap.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("app.bootstrap.description")}
          </Typography>
          {props.hasError ? (
            <Button className="electron-webkit-app-region-no-drag" variant="outlined" onClick={props.onRetry}>
              {t("app.bootstrap.retry")}
            </Button>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
}
