import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createJSONStorage, persist } from "zustand/middleware";

export const LINK_SETTINGS_STORE_STORAGE_KEY = "yishan-link-settings-store";

export type LinkTarget = "built-in" | "external";

type LinkSettingsStoreState = {
  linkTarget: LinkTarget;
  setLinkTarget: (target: LinkTarget) => void;
};

export const linkSettingsStore = create<LinkSettingsStoreState>()(
  persist(
    immer((set) => ({
      linkTarget: "built-in" as LinkTarget,
      setLinkTarget: (linkTarget) => {
        set({ linkTarget });
      },
    })),
    {
      name: LINK_SETTINGS_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        linkTarget: state.linkTarget,
      }),
    },
  ),
);
