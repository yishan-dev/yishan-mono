import {
  type DesignTokenThemeMode,
  ELEVATION_TOKENS,
  SEMANTIC_COLOR_TOKENS,
  SHAPE_TOKENS,
  TYPOGRAPHY_TOKENS,
} from "./index";

/**
 * React Native-friendly token bundle produced from shared semantic tokens.
 */
export type ReactNativeThemeTokens = {
  mode: DesignTokenThemeMode;
  colors: {
    textPrimary: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    backgroundApp: string;
    backgroundSurface: string;
    borderDefault: string;
    actionActive: string;
    actionHover: string;
    actionSelected: string;
  };
  typography: {
    fontFamily: string;
    bodyFontSize: number;
    captionFontSize: number;
  };
  shape: {
    borderRadiusSm: number;
    borderRadiusMd: number;
  };
  elevation: {
    buttonShadow: string;
    buttonHoverShadow: string;
  };
};

/**
 * Creates one React Native adapter payload for use with `StyleSheet.create` and custom theming layers.
 */
export function createReactNativeThemeTokens(mode: DesignTokenThemeMode): ReactNativeThemeTokens {
  const semantics = SEMANTIC_COLOR_TOKENS[mode];
  const elevation = mode === "dark" ? ELEVATION_TOKENS.dark : ELEVATION_TOKENS.light;

  return {
    mode,
    colors: {
      textPrimary: semantics.text.primary,
      textSecondary: semantics.text.secondary,
      primary: semantics.primary,
      secondary: semantics.secondary,
      backgroundApp: semantics.background.app,
      backgroundSurface: semantics.background.surface,
      borderDefault: semantics.border.default,
      actionActive: semantics.action.active,
      actionHover: semantics.action.hover,
      actionSelected: semantics.action.selected,
    },
    typography: {
      fontFamily: TYPOGRAPHY_TOKENS.fontFamily,
      bodyFontSize: TYPOGRAPHY_TOKENS.baseFontSizePx,
      captionFontSize: TYPOGRAPHY_TOKENS.body2FontSizeRem * TYPOGRAPHY_TOKENS.baseFontSizePx,
    },
    shape: {
      borderRadiusSm: SHAPE_TOKENS.borderRadiusSm,
      borderRadiusMd: SHAPE_TOKENS.borderRadiusMd,
    },
    elevation: {
      buttonShadow: elevation.button,
      buttonHoverShadow: elevation.buttonHover,
    },
  };
}
