import { useCallback, useState } from "react";

export function useProjectListDialogState() {
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [createWorkspaceProjectId, setCreateWorkspaceProjectId] = useState("");
  const [renameWorkspaceContext, setRenameWorkspaceContext] = useState<{
    projectId: string;
    workspaceId: string;
  } | null>(null);
  const [isProjectConfigOpen, setIsProjectConfigOpen] = useState(false);
  const [projectConfigProjectId, setProjectConfigProjectId] = useState("");

  const handleOpenCreateWorkspace = useCallback((projectId: string) => {
    setCreateWorkspaceProjectId(projectId);
    setIsCreateWorkspaceOpen(true);
  }, []);

  const handleOpenProjectConfig = useCallback((projectId: string) => {
    setProjectConfigProjectId(projectId);
    setIsProjectConfigOpen(true);
  }, []);

  return {
    isCreateWorkspaceOpen,
    createWorkspaceProjectId,
    renameWorkspaceContext,
    isProjectConfigOpen,
    projectConfigProjectId,
    setIsCreateWorkspaceOpen,
    setCreateWorkspaceProjectId,
    setRenameWorkspaceContext,
    setIsProjectConfigOpen,
    setProjectConfigProjectId,
    handleOpenCreateWorkspace,
    handleOpenProjectConfig,
  };
}
