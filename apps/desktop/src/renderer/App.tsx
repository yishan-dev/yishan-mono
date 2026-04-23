import { Box, CssBaseline, ThemeProvider, Typography, useMediaQuery } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type AppThemePreference, createAppTheme, resolveAppThemeMode } from "./theme";

export function App() {
  const { t } = useTranslation();
  const themePreference: AppThemePreference = "system";
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const mode = resolveAppThemeMode(themePreference, systemPrefersDark);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="container">
        <Typography component="h1" variant="h3">
          {t("app.title")}
        </Typography>
        <Typography variant="body1">{t("app.subtitle")}</Typography>
      </Box>
    </ThemeProvider>
  );
}
