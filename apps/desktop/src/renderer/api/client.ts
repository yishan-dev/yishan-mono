import { listOrganizationNodes } from "./nodeApi";
import { createOrganization, listOrganizationMembers, listOrganizations } from "./orgApi";
import { createProject, deleteProject, listProjects, updateProject } from "./projectApi";
import { createProjectWorkspace, listProjectWorkspaces } from "./workspaceApi";
import { listWorkspacePullRequests, upsertWorkspacePullRequest } from "./workspacePullRequestApi";

export const api = {
  org: {
    list: listOrganizations,
    create: createOrganization,
    listMembers: listOrganizationMembers,
  },
  node: {
    listByOrg: listOrganizationNodes,
  },
  project: {
    listByOrg: listProjects,
    create: createProject,
    delete: deleteProject,
    update: updateProject,
  },
  workspace: {
    listByProject: listProjectWorkspaces,
    createForProject: createProjectWorkspace,
  },
  workspacePullRequest: {
    list: listWorkspacePullRequests,
    upsert: upsertWorkspacePullRequest,
  },
};

export type ApiClient = typeof api;
