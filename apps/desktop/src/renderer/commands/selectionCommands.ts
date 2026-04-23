import { tabStore } from "../store/tabStore";
import { workspaceStore } from "../store/workspaceStore";

/** Selects one repo and syncs tab selection to the newly selected workspace. */
export function setSelectedRepo(repoId: string): void {
  workspaceStore.getState().setSelectedRepoId(repoId);
  tabStore.getState().setSelectedWorkspaceId(workspaceStore.getState().selectedWorkspaceId);
}

/** Selects one workspace in both workspace and tab stores. */
export function setSelectedWorkspace(workspaceId: string): void {
  workspaceStore.getState().setSelectedWorkspaceId(workspaceId);
  tabStore.getState().setSelectedWorkspaceId(workspaceId);
}
