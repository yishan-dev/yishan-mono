import type { AppDb } from "../db/client";
import type { ServiceConfig } from "../types";
import { AuthService } from "./auth-service";
import { OrganizationService } from "./organization-service";
import { UserService } from "./user-service";

export type AppServices = {
  user: UserService;
  auth: AuthService;
  organization: OrganizationService;
};

export function createServices(deps: { db: AppDb; config: ServiceConfig }): AppServices {
  const user = new UserService(deps.db);

  return {
    user,
    auth: new AuthService(deps.db, deps.config, user),
    organization: new OrganizationService(deps.db)
  };
}
