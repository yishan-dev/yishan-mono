import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuFolder, LuFolderOpen, LuGlobe } from "react-icons/lu";
import { useCommands } from "../../../hooks/useCommands";

type CreateProjectDialogViewProps = {
  open: boolean;
  onClose: () => void;
};

type RepoDraft = {
  name: string;
  source: "local" | "remote";
  path: string;
  gitUrl: string;
  sourceTypeHint?: "unknown" | "git-local" | "git";
  nameEdited: boolean;
};

type CreateProjectInput = {
  name: string;
  sourceTypeHint?: "unknown" | "git-local" | "git";
  path?: string;
  gitUrl?: string;
};

/** Converts one local path or URL into a default project display name. */
function deriveDefaultProjectName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replace(/\\+$/g, "").replace(/\/+$/g, "");
  const segment =
    normalized
      .split(/[\\/]/)
      .filter((part) => part.length > 0)
      .at(-1) ?? "";
  return segment.replace(/\.git$/i, "");
}

const defaultDraft: RepoDraft = { name: "", source: "local", path: "", gitUrl: "", nameEdited: false };

export function CreateProjectDialogView({ open, onClose }: CreateProjectDialogViewProps) {
  const { t } = useTranslation();
  const { createProject, inspectLocalProjectSource, openLocalFolderDialog } = useCommands();
  const [repoDraft, setRepoDraft] = useState<RepoDraft>(defaultDraft);

  const createProjectMutation = useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      await createProject(input);
    },
    onSuccess: () => {
      setRepoDraft(defaultDraft);
      onClose();
    },
  });

  const isCreating = createProjectMutation.isPending;

  const resetAndClose = () => {
    if (isCreating) {
      return;
    }
    setRepoDraft(defaultDraft);
    onClose();
  };

  const isCreateDisabled =
    repoDraft.name.trim().length === 0 ||
    (repoDraft.source === "local" ? repoDraft.path.trim().length === 0 : repoDraft.gitUrl.trim().length === 0);

  const handlePickRepoFolder = async () => {
    const selectedPath = await openLocalFolderDialog(repoDraft.path.trim() || undefined);
    if (selectedPath) {
      const sourceInspection = await inspectLocalProjectSource(selectedPath);
      setRepoDraft((previous) => {
        const nextName = previous.nameEdited ? previous.name : deriveDefaultProjectName(selectedPath);
        return {
          ...previous,
          path: selectedPath,
          gitUrl: sourceInspection.remoteUrl ?? "",
          name: nextName,
          sourceTypeHint: sourceInspection.sourceTypeHint,
        };
      });
    }
  };

  const handleCreateRepo = () => {
    if (isCreating) {
      return;
    }

    const name = repoDraft.name.trim();
    const location = repoDraft.source === "local" ? repoDraft.path.trim() : repoDraft.gitUrl.trim();

    if (!name || !location) {
      return;
    }

    createProjectMutation.mutate(
      {
        name,
        sourceTypeHint: repoDraft.source === "remote" ? "git" : repoDraft.sourceTypeHint,
        path: repoDraft.source === "local" ? location : "",
        gitUrl:
          repoDraft.source === "remote" ? location : repoDraft.sourceTypeHint === "git" ? repoDraft.gitUrl.trim() : "",
      },
      {
        onError: (error) => {
          console.error("Failed to create project", error);
        },
      },
    );
  };

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="sm" disableEscapeKeyDown={isCreating}>
      <DialogTitle>{t("project.actions.addRepository")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("project.form.source.label")}
            </Typography>
            <ButtonGroup size="small" fullWidth>
              <Button
                startIcon={<LuFolder size={14} />}
                variant={repoDraft.source === "local" ? "contained" : "outlined"}
                disabled={isCreating}
                onClick={() =>
                  setRepoDraft((previous) => {
                    const nextName = previous.nameEdited ? previous.name : deriveDefaultProjectName(previous.path);
                    return {
                      ...previous,
                      source: "local",
                      name: nextName,
                      sourceTypeHint: previous.path ? previous.sourceTypeHint : undefined,
                    };
                  })
                }
              >
                {t("project.form.source.local")}
              </Button>
              <Button
                startIcon={<LuGlobe size={14} />}
                variant={repoDraft.source === "remote" ? "contained" : "outlined"}
                disabled={isCreating}
                onClick={() =>
                  setRepoDraft((previous) => {
                    const nextName = previous.nameEdited ? previous.name : deriveDefaultProjectName(previous.gitUrl);
                    return {
                      ...previous,
                      source: "remote",
                      name: nextName,
                      sourceTypeHint: "git",
                    };
                  })
                }
              >
                {t("project.form.source.remote")}
              </Button>
            </ButtonGroup>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {repoDraft.source === "local" ? t("project.form.path") : t("project.form.gitUrl")}
            </Typography>
            <TextField
              autoFocus
              size="small"
              value={repoDraft.source === "local" ? repoDraft.path : repoDraft.gitUrl}
              disabled={isCreating}
              onChange={(event) =>
                setRepoDraft((previous) => {
                  const nextLocation = event.target.value;
                  const nextName = previous.nameEdited ? previous.name : deriveDefaultProjectName(nextLocation);
                  return {
                    ...previous,
                    [repoDraft.source === "local" ? "path" : "gitUrl"]: nextLocation,
                    name: nextName,
                    gitUrl: repoDraft.source === "local" ? "" : nextLocation,
                    sourceTypeHint: repoDraft.source === "remote" ? "git" : undefined,
                  };
                })
              }
              fullWidth
              placeholder={repoDraft.source === "remote" ? "https://github.com/org/repo.git" : undefined}
              slotProps={
                repoDraft.source === "local"
                  ? {
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={t("project.form.chooseFolder")} arrow>
                              <IconButton
                                edge="end"
                                aria-label={t("project.form.chooseFolder")}
                                disabled={isCreating}
                                onClick={handlePickRepoFolder}
                              >
                                <LuFolderOpen size={18} />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      },
                    }
                  : undefined
              }
            />
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t("project.form.name")}
            </Typography>
            <TextField
              size="small"
              disabled={isCreating}
              value={repoDraft.name}
              onChange={(event) =>
                setRepoDraft((previous) => ({
                  ...previous,
                  name: event.target.value,
                  nameEdited: true,
                }))
              }
              fullWidth
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose} disabled={isCreating}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreateRepo()}
          disabled={isCreateDisabled || isCreating}
          startIcon={isCreating ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {isCreating ? t("common.actions.creating", { defaultValue: "Creating..." }) : t("project.form.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
