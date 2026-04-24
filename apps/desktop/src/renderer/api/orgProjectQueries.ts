import { listOrganizations, listProjects, listProjectWorkspaces, type ProjectWorkspaceRecord } from "./orgProjectApi";

export type OrgProjectSnapshot = {
  organizationId?: string;
  projects: Awaited<ReturnType<typeof listProjects>>;
  workspaces: ProjectWorkspaceRecord[];
};

/** Loads one org/project/workspace snapshot from remote REST api-service. */
export async function getOrgProjectSnapshot(): Promise<OrgProjectSnapshot> {
  const organizations = await listOrganizations();
  const primaryOrganization = organizations[0];
  if (!primaryOrganization) {
    return {
      projects: [],
      workspaces: [],
    };
  }

  const projects = await listProjects(primaryOrganization.id);
  const workspaceLists = await Promise.all(
    projects.map(async (project) => {
      return await listProjectWorkspaces(primaryOrganization.id, project.id);
    }),
  );

  return {
    organizationId: primaryOrganization.id,
    projects,
    workspaces: workspaceLists.flat(),
  };
}
