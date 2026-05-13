import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  LuCircle,
  LuCircleCheck,
  LuCircleX,
  LuGlobe,
  LuLoaderCircle,
  LuSearch,
  LuSquareTerminal,
  LuTriangleAlert,
} from "react-icons/lu";
import { useCommands } from "../../hooks/useCommands";
import { getRendererPlatform } from "../../helpers/platform";
import { getShortcutDisplayLabelById } from "../../shortcuts/shortcutDisplay";
import { workspaceCreateProgressStore, type WorkspaceCreateProgressStep } from "../../store/workspaceCreateProgressStore";
import { workspaceStore } from "../../store/workspaceStore";

function CreateProgressStepIcon({ step }: { step: WorkspaceCreateProgressStep }) {
  if (step.status === "completed") {
    return (
      <Box component="span" sx={{ display: "inline-flex", color: "success.main" }}>
        <LuCircleCheck size={16} />
      </Box>
    );
  }

  if (step.status === "failed") {
    return <LuCircleX size={16} color="var(--mui-palette-error-main)" />;
  }

  if (step.status === "warning") {
    return <LuTriangleAlert size={16} color="var(--mui-palette-warning-main)" />;
  }

  if (step.status === "running") {
    return (
      <Box component="span" sx={{ display: "inline-flex", color: "warning.main" }}>
        <LuLoaderCircle size={16} className="spin" />
      </Box>
    );
  }

  return <LuCircle size={16} />;
}

/** Renders quick actions when no tab is open in the selected workspace. */
export function LaunchView() {
  const { t } = useTranslation();
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const selectedWorkspace = workspaceStore((state) =>
    (state.workspaces ?? []).find((workspace) => workspace.id === state.selectedWorkspaceId),
  );
  const workspaceCreateProgress = workspaceCreateProgressStore(
    (state) => state.progressByWorkspaceId[selectedWorkspaceId],
  );
  const { openTab, openWorkspaceFileSearch } = useCommands();
  const platform = getRendererPlatform();
  const isPreparingWorkspace = Boolean(workspaceCreateProgress && !workspaceCreateProgress.isComplete);

  const launchActions = [
    {
      id: "terminal",
      label: t("launch.actions.openTerminal"),
      shortcutLabel: getShortcutDisplayLabelById("open-terminal", platform),
      icon: <LuSquareTerminal size={16} />,
      onClick: () =>
        openTab({
          workspaceId: selectedWorkspaceId,
          kind: "terminal",
          title: t("terminal.title"),
          reuseExisting: false,
        }),
    },
    {
      id: "browser",
      label: t("launch.actions.openBrowser"),
      shortcutLabel: getShortcutDisplayLabelById("open-browser", platform),
      icon: <LuGlobe size={16} />,
      onClick: () =>
        openTab({
          workspaceId: selectedWorkspaceId,
          kind: "browser",
          url: "https://example.com",
        }),
    },
    {
      id: "search-files",
      label: t("launch.actions.searchFiles"),
      shortcutLabel: getShortcutDisplayLabelById("open-file-search", platform),
      icon: <LuSearch size={16} />,
      onClick: openWorkspaceFileSearch,
    },
  ];

  if (isPreparingWorkspace && workspaceCreateProgress) {
    return (
      <Box
        sx={{
          flex: 1,
          px: 3,
          py: 4,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Typography variant="h6">Preparing workspace</Typography>
        <Typography variant="body2" color="text.secondary">
          You can follow setup progress here while the daemon finishes provisioning.
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.25,
            width: "min(420px, 100%)",
            mt: 1,
            "@keyframes workspace-create-spin": {
              from: { transform: "rotate(0deg)" },
              to: { transform: "rotate(360deg)" },
            },
            "& .spin": {
              animation: "workspace-create-spin 1s linear infinite",
            },
          }}
        >
          {workspaceCreateProgress.steps.map((step) => (
            <Box
              key={step.id}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                px: 1.25,
                py: 1,
                bgcolor: "background.paper",
              }}
            >
              <Box sx={{ display: "inline-flex", mt: 0.25, color: "text.secondary" }}>
                <CreateProgressStepIcon step={step} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2">{step.label}</Typography>
                {step.message ? (
                  <Typography variant="caption" color="text.secondary">
                    {step.message}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        px: 3,
        py: 4,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Typography variant="h6">{t("launch.title")}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t("launch.hint")}
      </Typography>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          width: 260,
        }}
      >
        {launchActions.map((action) => (
          <Box
            key={action.id}
            component="button"
            type="button"
            onClick={action.onClick}
            disabled={!selectedWorkspaceId}
            sx={{
              minHeight: 40,
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              px: 1.25,
              bgcolor: "background.paper",
              color: "text.primary",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              cursor: selectedWorkspaceId ? "pointer" : "not-allowed",
              textAlign: "left",
              typography: "body2",
            }}
          >
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
              {action.icon}
              <Box component="span">{action.label}</Box>
            </Box>
            {action.shortcutLabel ? (
              <Typography
                variant="caption"
                color="text.secondary"
                component="span"
                aria-hidden="true"
                sx={{ fontSize: 13, lineHeight: 1 }}
              >
                {action.shortcutLabel}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
