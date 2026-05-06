export const EXTERNAL_APP_IDS = [
  "cursor",
  "antigravity",
  "windsurf",
  "zed",
  "sublime-text",
  "xcode",
  "vscode",
  "vscode-insiders",
  "jetbrains-intellij-idea",
  "jetbrains-intellij-idea-ce",
  "jetbrains-webstorm",
  "jetbrains-pycharm",
  "jetbrains-pycharm-ce",
  "jetbrains-goland",
  "jetbrains-clion",
  "jetbrains-rider",
  "jetbrains-phpstorm",
  "jetbrains-rustrover",
  "jetbrains-datagrip",
  "jetbrains-android-studio",
] as const;

export type ExternalAppId = (typeof EXTERNAL_APP_IDS)[number];

export type ExternalAppPreset = {
  id: ExternalAppId;
  label: string;
  iconSrc: string;
  darwinAppNames: readonly string[];
  linuxCommands: readonly string[];
};

export type ExternalAppMenuEntry =
  | {
      kind: "app";
      appId: ExternalAppId;
    }
  | {
      kind: "group";
      id: "jetbrains";
      label: string;
      iconSrc: string;
      appIds: readonly ExternalAppId[];
    };

export type ExternalAppPlatform = NodeJS.Platform | "unknown";

export const SYSTEM_FILE_MANAGER_APP_ID = "system-file-manager" as const;

export type WorkspaceEntryAppId = ExternalAppId | typeof SYSTEM_FILE_MANAGER_APP_ID;

const APP_ICONS_BASE_PATH = "app-icons";

/** Resolves one app icon path relative to renderer index.html for file:// builds. */
function resolveAppIconPath(fileName: string): string {
  return `${APP_ICONS_BASE_PATH}/${fileName}`;
}

/** Shared external-app presets used by file-tree "open in app" menu and desktop RPC launch handlers. */
export const EXTERNAL_APP_PRESETS: readonly ExternalAppPreset[] = [
  {
    id: "cursor",
    label: "Cursor",
    iconSrc: resolveAppIconPath("cursor.svg"),
    darwinAppNames: ["Cursor"],
    linuxCommands: ["cursor"],
  },
  {
    id: "antigravity",
    label: "Antigravity",
    iconSrc: resolveAppIconPath("antigravity.svg"),
    darwinAppNames: ["Antigravity"],
    linuxCommands: ["antigravity"],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    iconSrc: resolveAppIconPath("windsurf.svg"),
    darwinAppNames: ["Windsurf"],
    linuxCommands: ["windsurf"],
  },
  {
    id: "zed",
    label: "Zed",
    iconSrc: resolveAppIconPath("zed.png"),
    darwinAppNames: ["Zed"],
    linuxCommands: ["zed"],
  },
  {
    id: "sublime-text",
    label: "Sublime Text",
    iconSrc: resolveAppIconPath("sublime.svg"),
    darwinAppNames: ["Sublime Text"],
    linuxCommands: ["subl"],
  },
  {
    id: "xcode",
    label: "Xcode",
    iconSrc: resolveAppIconPath("xcode.svg"),
    darwinAppNames: ["Xcode"],
    linuxCommands: ["xed"],
  },
  {
    id: "vscode",
    label: "VS Code",
    iconSrc: resolveAppIconPath("vscode.svg"),
    darwinAppNames: ["Visual Studio Code"],
    linuxCommands: ["code"],
  },
  {
    id: "vscode-insiders",
    label: "VS Code Insiders",
    iconSrc: resolveAppIconPath("vscode-insiders.svg"),
    darwinAppNames: ["Visual Studio Code - Insiders"],
    linuxCommands: ["code-insiders"],
  },
  {
    id: "jetbrains-intellij-idea",
    label: "IntelliJ IDEA",
    iconSrc: resolveAppIconPath("intellij.svg"),
    darwinAppNames: ["IntelliJ IDEA"],
    linuxCommands: ["idea"],
  },
  {
    id: "jetbrains-intellij-idea-ce",
    label: "IntelliJ IDEA CE",
    iconSrc: resolveAppIconPath("intellij.svg"),
    darwinAppNames: ["IntelliJ IDEA CE"],
    linuxCommands: ["idea"],
  },
  {
    id: "jetbrains-webstorm",
    label: "WebStorm",
    iconSrc: resolveAppIconPath("webstorm.svg"),
    darwinAppNames: ["WebStorm"],
    linuxCommands: ["webstorm"],
  },
  {
    id: "jetbrains-pycharm",
    label: "PyCharm",
    iconSrc: resolveAppIconPath("pycharm.svg"),
    darwinAppNames: ["PyCharm"],
    linuxCommands: ["pycharm"],
  },
  {
    id: "jetbrains-pycharm-ce",
    label: "PyCharm CE",
    iconSrc: resolveAppIconPath("pycharm.svg"),
    darwinAppNames: ["PyCharm CE"],
    linuxCommands: ["pycharm"],
  },
  {
    id: "jetbrains-goland",
    label: "GoLand",
    iconSrc: resolveAppIconPath("goland.svg"),
    darwinAppNames: ["GoLand"],
    linuxCommands: ["goland"],
  },
  {
    id: "jetbrains-clion",
    label: "CLion",
    iconSrc: resolveAppIconPath("clion.svg"),
    darwinAppNames: ["CLion"],
    linuxCommands: ["clion"],
  },
  {
    id: "jetbrains-rider",
    label: "Rider",
    iconSrc: resolveAppIconPath("rider.svg"),
    darwinAppNames: ["Rider"],
    linuxCommands: ["rider"],
  },
  {
    id: "jetbrains-phpstorm",
    label: "PhpStorm",
    iconSrc: resolveAppIconPath("phpstorm.svg"),
    darwinAppNames: ["PhpStorm"],
    linuxCommands: ["phpstorm"],
  },
  {
    id: "jetbrains-rustrover",
    label: "RustRover",
    iconSrc: resolveAppIconPath("rustrover.svg"),
    darwinAppNames: ["RustRover"],
    linuxCommands: ["rustrover"],
  },
  {
    id: "jetbrains-datagrip",
    label: "DataGrip",
    iconSrc: resolveAppIconPath("datagrip.svg"),
    darwinAppNames: ["DataGrip"],
    linuxCommands: ["datagrip"],
  },
  {
    id: "jetbrains-android-studio",
    label: "Android Studio",
    iconSrc: resolveAppIconPath("android-studio.svg"),
    darwinAppNames: ["Android Studio"],
    linuxCommands: ["studio"],
  },
];

export const JETBRAINS_EXTERNAL_APP_IDS = [
  "jetbrains-intellij-idea",
  "jetbrains-intellij-idea-ce",
  "jetbrains-webstorm",
  "jetbrains-pycharm",
  "jetbrains-pycharm-ce",
  "jetbrains-goland",
  "jetbrains-clion",
  "jetbrains-rider",
  "jetbrains-phpstorm",
  "jetbrains-rustrover",
  "jetbrains-datagrip",
  "jetbrains-android-studio",
] as const satisfies readonly ExternalAppId[];

export const EXTERNAL_APP_MENU_ENTRIES: readonly ExternalAppMenuEntry[] = [
  { kind: "app", appId: "cursor" },
  { kind: "app", appId: "antigravity" },
  { kind: "app", appId: "windsurf" },
  { kind: "app", appId: "zed" },
  { kind: "app", appId: "sublime-text" },
  { kind: "app", appId: "xcode" },
  { kind: "app", appId: "vscode" },
  { kind: "app", appId: "vscode-insiders" },
  {
    kind: "group",
    id: "jetbrains",
    label: "JetBrains",
    iconSrc: resolveAppIconPath("jetbrains.svg"),
    appIds: JETBRAINS_EXTERNAL_APP_IDS,
  },
];

/** Normalizes one browser or Node platform value to one stable platform id used by open-in-app logic. */
export function normalizeExternalAppPlatform(platform: string): ExternalAppPlatform {
  const normalizedPlatform = platform.trim().toLowerCase();

  if (!normalizedPlatform) {
    return "unknown";
  }

  if (normalizedPlatform === "darwin" || normalizedPlatform.includes("mac")) {
    return "darwin";
  }

  if (normalizedPlatform === "linux" || normalizedPlatform.includes("linux")) {
    return "linux";
  }

  if (normalizedPlatform === "win32" || normalizedPlatform.includes("win")) {
    return "win32";
  }

  return "unknown";
}

/** Returns true when one platform has implemented external-app launch support. */
export function isExternalAppPlatformSupported(platform: string): boolean {
  const normalizedPlatform = normalizeExternalAppPlatform(platform);
  return normalizedPlatform === "darwin" || normalizedPlatform === "linux";
}

/** Returns one external-app preset by id, or null when the id is unsupported. */
export function findExternalAppPreset(appId: string): ExternalAppPreset | null {
  return EXTERNAL_APP_PRESETS.find((preset) => preset.id === appId) ?? null;
}
