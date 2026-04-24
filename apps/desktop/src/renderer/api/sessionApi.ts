import { listOrganizations, type OrganizationRecord } from "./orgProjectApi";
import { requestJson } from "./restClient";

export type CurrentUserRecord = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

/** Loads current authenticated user profile from remote API. */
export async function getCurrentUser(): Promise<CurrentUserRecord> {
  const response = await requestJson<{ user: CurrentUserRecord }>("/me");
  return response.user;
}

/** Loads session bootstrap data required by renderer app state. */
export async function getSessionBootstrapData(): Promise<{
  currentUser: CurrentUserRecord;
  organizations: OrganizationRecord[];
}> {
  const [currentUser, organizations] = await Promise.all([getCurrentUser(), listOrganizations()]);
  return { currentUser, organizations };
}
