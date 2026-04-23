import { describe, expect, it } from "vitest";
import {
  DESIGN_TOKEN_VERSION,
  SEMANTIC_COLOR_TOKENS,
  createMuiThemeOptions,
  createReactNativeThemeTokens,
  getDesignTokenPackageInfo,
} from "./index";

describe("getDesignTokenPackageInfo", () => {
  it("returns design token package identity metadata", () => {
    expect(getDesignTokenPackageInfo()).toEqual({
      name: "@yishan/design-tokens",
      layer: "ui-foundation",
    });
  });
});

describe("token version exports", () => {
  it("exposes a stable v1 token contract", () => {
    expect(DESIGN_TOKEN_VERSION).toBe("v1");
    expect(SEMANTIC_COLOR_TOKENS.light.background.app).toBe("#f8f8f9");
    expect(SEMANTIC_COLOR_TOKENS.dark.background.app).toBe("#23262e");
  });
});

describe("platform adapters", () => {
  it("builds a MUI theme option payload", () => {
    const muiOptions = createMuiThemeOptions("dark");

    expect(muiOptions.palette).toMatchObject({
      mode: "dark",
      background: {
        default: "#23262e",
        paper: "#23262e",
      },
      text: {
        primary: "#d2d6de",
      },
      action: {
        selected: "#363d4a",
      },
    });
  });

  it("keeps light-mode MUI action states on framework defaults", () => {
    const muiOptions = createMuiThemeOptions("light");

    expect(muiOptions.palette).not.toHaveProperty("action");
  });

  it("builds a React Native token payload", () => {
    const nativeTheme = createReactNativeThemeTokens("light");

    expect(nativeTheme).toMatchObject({
      mode: "light",
      colors: {
        backgroundApp: "#f8f8f9",
        textPrimary: "#2a2a31",
      },
      typography: {
        bodyFontSize: 14,
        captionFontSize: 12.25,
      },
      shape: {
        borderRadiusSm: 4,
        borderRadiusMd: 8,
      },
    });
  });
});
