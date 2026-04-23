/**
 * Design token package identity metadata.
 */
export type DesignTokenPackageInfo = {
  name: "@yishan/design-tokens";
  layer: "ui-foundation";
};

/**
 * Returns package metadata for design-token boundary checks.
 */
export function getDesignTokenPackageInfo(): DesignTokenPackageInfo {
  return {
    name: "@yishan/design-tokens",
    layer: "ui-foundation",
  };
}

export * from "./v1/index";
export * from "./v1/mui";
export * from "./v1/reactNative";
