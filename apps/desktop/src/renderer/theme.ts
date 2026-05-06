import { createTheme } from "@mui/material/styles";
import type { DesignTokenThemeMode } from "@yishan/design-tokens/v1";
import { MUI_DARK_SURFACE_COLORS, createMuiThemeOptions } from "@yishan/design-tokens/v1/mui";

export type AppThemeMode = DesignTokenThemeMode;
export type AppThemePreference = AppThemeMode | "system";

export const DARK_SURFACE_COLORS = MUI_DARK_SURFACE_COLORS;

function isAppThemeMode(value: string): value is AppThemeMode {
  return value === "light" || value === "dark";
}

export function resolveAppThemeMode(preference: AppThemePreference, systemPrefersDark: boolean): AppThemeMode {
  if (preference === "system") {
    return systemPrefersDark ? "dark" : "light";
  }

  if (typeof preference === "string" && isAppThemeMode(preference)) {
    return preference;
  }

  return systemPrefersDark ? "dark" : "light";
}

export function createAppTheme(mode: AppThemeMode) {
  return createTheme(createMuiThemeOptions(mode));
}
