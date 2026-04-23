/**
 * Stable token contract version exported by this package.
 */
export const DESIGN_TOKEN_VERSION = "v1" as const;

/**
 * Supported visual modes for semantic token selection.
 */
export type DesignTokenThemeMode = "light" | "dark";

/**
 * Shared typography token values reused by platform adapters.
 */
export const TYPOGRAPHY_TOKENS = {
  baseFontSizePx: 14,
  body2FontSizeRem: 0.875,
  fontFamily: '"Manrope", "SF Pro Text", "Segoe UI", sans-serif',
} as const;

/**
 * Shared shape token values reused by platform adapters.
 */
export const SHAPE_TOKENS = {
  borderRadiusSm: 4,
  borderRadiusMd: 8,
} as const;

/**
 * Shared elevation token values reused by platform adapters.
 */
export const ELEVATION_TOKENS = {
  light: {
    button: "0 1px 2px rgba(42, 42, 49, 0.14)",
    buttonHover: "0 1px 3px rgba(42, 42, 49, 0.2)",
  },
  dark: {
    button: "0 1px 2px rgba(0, 0, 0, 0.22)",
    buttonHover: "0 1px 3px rgba(0, 0, 0, 0.28)",
  },
} as const;

/**
 * Framework-agnostic primitive color values.
 */
export const COLOR_PRIMITIVES = {
  brand: {
    sand500: "#b88d72",
    sand300: "#e6c26a",
  },
  neutral: {
    slate950: "#1a1e25",
    slate900: "#1d2129",
    slate850: "#23262e",
    slate800: "#262c36",
    slate700: "#313745",
    slate650: "#363d4a",
    slate600: "#3a404d",
    slate500: "#4b5464",
    slate400: "#7f8796",
    slate300: "#9aa1ad",
    slate200: "#d2d6de",
    slate100: "#d7deef",
    silver300: "#cfd5df",
    silver200: "#dcdce1",
    white200: "#f8f8f9",
    white150: "#f5f6f8",
    white100: "#f3f3f5",
    white050: "#f1f3f7",
    white000: "#ffffff",
    ink900: "#2a2a31",
    ink600: "#676773",
    ink200: "#dde0e6",
  },
} as const;

/**
 * Framework-agnostic semantic color values for each mode.
 */
export const SEMANTIC_COLOR_TOKENS = {
  light: {
    text: {
      primary: COLOR_PRIMITIVES.neutral.ink900,
      secondary: COLOR_PRIMITIVES.neutral.ink600,
      contrastOnPrimary: "#eee",
      accent: COLOR_PRIMITIVES.neutral.ink900,
    },
    background: {
      app: COLOR_PRIMITIVES.neutral.white200,
      surface: COLOR_PRIMITIVES.neutral.white100,
      editor: COLOR_PRIMITIVES.neutral.white000,
      gutter: COLOR_PRIMITIVES.neutral.white150,
      activeLine: COLOR_PRIMITIVES.neutral.white050,
    },
    border: {
      default: COLOR_PRIMITIVES.neutral.silver200,
      editor: COLOR_PRIMITIVES.neutral.ink200,
    },
    action: {
      active: COLOR_PRIMITIVES.neutral.ink600,
      hover: COLOR_PRIMITIVES.neutral.white050,
      selected: COLOR_PRIMITIVES.neutral.silver300,
    },
    primary: COLOR_PRIMITIVES.brand.sand500,
    secondary: COLOR_PRIMITIVES.neutral.silver300,
  },
  dark: {
    text: {
      primary: COLOR_PRIMITIVES.neutral.slate200,
      secondary: COLOR_PRIMITIVES.neutral.slate300,
      contrastOnPrimary: COLOR_PRIMITIVES.neutral.slate950,
      accent: COLOR_PRIMITIVES.neutral.slate200,
    },
    background: {
      app: COLOR_PRIMITIVES.neutral.slate850,
      surface: COLOR_PRIMITIVES.neutral.slate850,
      editor: COLOR_PRIMITIVES.neutral.slate950,
      gutter: COLOR_PRIMITIVES.neutral.slate900,
      activeLine: COLOR_PRIMITIVES.neutral.slate800,
    },
    border: {
      default: COLOR_PRIMITIVES.neutral.slate600,
      editor: COLOR_PRIMITIVES.neutral.slate600,
    },
    action: {
      active: COLOR_PRIMITIVES.neutral.slate400,
      hover: COLOR_PRIMITIVES.neutral.slate700,
      selected: COLOR_PRIMITIVES.neutral.slate650,
    },
    primary: COLOR_PRIMITIVES.brand.sand300,
    secondary: COLOR_PRIMITIVES.neutral.slate500,
  },
} as const;

/**
 * Shared editor surface colors used by both desktop and mobile presentation layers.
 */
export const EDITOR_SURFACE_COLORS = {
  light: {
    mainPane: SEMANTIC_COLOR_TOKENS.light.background.editor,
    gutter: SEMANTIC_COLOR_TOKENS.light.background.gutter,
    activeLine: SEMANTIC_COLOR_TOKENS.light.background.activeLine,
    border: SEMANTIC_COLOR_TOKENS.light.border.editor,
  },
  dark: {
    mainPane: COLOR_PRIMITIVES.neutral.slate950,
    elevated: SEMANTIC_COLOR_TOKENS.dark.background.surface,
    gutter: SEMANTIC_COLOR_TOKENS.dark.background.gutter,
    activeLine: SEMANTIC_COLOR_TOKENS.dark.background.activeLine,
    border: SEMANTIC_COLOR_TOKENS.dark.border.default,
  },
} as const;

/**
 * Backward-compatible dark surface aliases currently used by desktop renderer views.
 */
export const DARK_SURFACE_COLORS = EDITOR_SURFACE_COLORS.dark;

/**
 * Returns one semantic color token group for a selected mode.
 */
export function getSemanticColorTokens(mode: DesignTokenThemeMode) {
  return SEMANTIC_COLOR_TOKENS[mode];
}
