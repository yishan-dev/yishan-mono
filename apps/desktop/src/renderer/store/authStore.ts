import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const AUTH_STORE_STORAGE_KEY = "yishan-auth-store";

type AuthStoreState = {
  isAuthenticated: boolean;
  setAuthenticated: (isAuthenticated: boolean) => void;
};

/** Stores one persisted signed-in flag used to gate app shell routes. */
export const authStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      setAuthenticated: (isAuthenticated) => {
        set({ isAuthenticated });
      },
    }),
    {
      name: AUTH_STORE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
