import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppThemePreference } from "../theme";

export const LAYOUT_STORE_STORAGE_KEY = "yishan-layout-store";
export const DEFAULT_LEFT_WIDTH = 320;
export const DEFAULT_RIGHT_WIDTH = 400;

type LayoutStoreState = {
  leftWidth: number;
  rightWidth: number;
  themePreference: AppThemePreference;
  isLeftPaneManuallyHidden: boolean;
  isRightPaneManuallyHidden: boolean;
  setLeftWidth: (width: number) => void;
  setRightWidth: (width: number) => void;
  setThemePreference: (preference: AppThemePreference) => void;
  setIsLeftPaneManuallyHidden: (hidden: boolean) => void;
  setIsRightPaneManuallyHidden: (hidden: boolean) => void;
};

/** Stores persisted desktop layout preferences including pane widths and theme mode preference. */
export const layoutStore = create<LayoutStoreState>()(
  persist(
    immer((set) => ({
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      themePreference: "system",
      isLeftPaneManuallyHidden: false,
      isRightPaneManuallyHidden: true,
      setLeftWidth: (leftWidth) => {
        set({ leftWidth });
      },
      setRightWidth: (rightWidth) => {
        set({ rightWidth });
      },
      setThemePreference: (themePreference) => {
        set({ themePreference });
      },
      setIsLeftPaneManuallyHidden: (isLeftPaneManuallyHidden) => {
        set({ isLeftPaneManuallyHidden });
      },
      setIsRightPaneManuallyHidden: (isRightPaneManuallyHidden) => {
        set({ isRightPaneManuallyHidden });
      },
    })),
    {
      name: LAYOUT_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        leftWidth: state.leftWidth,
        rightWidth: state.rightWidth,
        themePreference: state.themePreference,
      }),
    },
  ),
);
