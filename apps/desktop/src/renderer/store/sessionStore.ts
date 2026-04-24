import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export type SessionOrganization = {
  id: string;
  name: string;
};

type SessionStoreState = {
  currentUser: SessionUser | null;
  organizations: SessionOrganization[];
  selectedOrganizationId?: string;
  loaded: boolean;
  setSessionData: (input: {
    currentUser: SessionUser | null;
    organizations: SessionOrganization[];
    selectedOrganizationId?: string;
  }) => void;
  setSelectedOrganizationId: (organizationId: string) => void;
  clearSessionData: () => void;
};

/** Stores renderer session metadata (user + organizations) for remote REST flows. */
export const sessionStore = create<SessionStoreState>()(
  persist(
    (set) => ({
      currentUser: null,
      organizations: [],
      selectedOrganizationId: undefined,
      loaded: false,
      setSessionData: ({ currentUser, organizations, selectedOrganizationId }) => {
        const normalizedSelectedOrganizationId =
          selectedOrganizationId && organizations.some((organization) => organization.id === selectedOrganizationId)
            ? selectedOrganizationId
            : organizations[0]?.id;

        set({
          currentUser,
          organizations,
          selectedOrganizationId: normalizedSelectedOrganizationId,
          loaded: true,
        });
      },
      setSelectedOrganizationId: (organizationId) => {
        set((state) => {
          if (!state.organizations.some((organization) => organization.id === organizationId)) {
            return state;
          }

          return {
            ...state,
            selectedOrganizationId: organizationId,
          };
        });
      },
      clearSessionData: () => {
        set({
          currentUser: null,
          organizations: [],
          selectedOrganizationId: undefined,
          loaded: false,
        });
      },
    }),
    {
      name: "yishan-session-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedOrganizationId: state.selectedOrganizationId,
      }),
    },
  ),
);
