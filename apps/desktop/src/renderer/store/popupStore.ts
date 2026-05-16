import { create } from "zustand";

type PopupStoreState = {
  popupCount: number;
  isPopupOpen: boolean;
  registerPopup: () => void;
  unregisterPopup: () => void;
};

export const popupStore = create<PopupStoreState>((set) => ({
  popupCount: 0,
  isPopupOpen: false,
  registerPopup: () =>
    set((state) => {
      const nextCount = state.popupCount + 1;
      return { popupCount: nextCount, isPopupOpen: nextCount > 0 };
    }),
  unregisterPopup: () =>
    set((state) => {
      const nextCount = Math.max(0, state.popupCount - 1);
      return { popupCount: nextCount, isPopupOpen: nextCount > 0 };
    }),
}));
