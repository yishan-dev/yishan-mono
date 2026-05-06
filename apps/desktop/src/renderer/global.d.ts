import type { DesktopBridge } from "@main/ipc";

declare global {
  interface Window {
    desktop?: {
      platform: NodeJS.Platform;
    };
    __YISHAN__: DesktopBridge;
  }
}

export {};
