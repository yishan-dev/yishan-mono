import type { Workspace } from "@/db/schema";

export type WorkspaceProvisionRequest = {
  workspace: Workspace;
  actorUserId: string;
};

export interface WorkspaceProvisioner {
  enqueueWorkspaceProvision(request: WorkspaceProvisionRequest): Promise<void>;
}

export class NoopWorkspaceProvisioner implements WorkspaceProvisioner {
  async enqueueWorkspaceProvision(_request: WorkspaceProvisionRequest): Promise<void> {
    return;
  }
}
