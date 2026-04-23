import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LuSearch, LuSquareTerminal } from "react-icons/lu";
import { useCommands } from "../../hooks/useCommands";
import { getRendererPlatform } from "../../helpers/platform";
import { getShortcutDisplayLabelById } from "../../shortcuts/shortcutDisplay";
import { workspaceStore } from "../../store/workspaceStore";

/** Renders quick actions when no tab is open in the selected workspace. */
export function LaunchView() {
  const { t } = useTranslation();
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const { openTab, openWorkspaceFileSearch } = useCommands();
  const platform = getRendererPlatform();

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
      id: "search-files",
      label: t("launch.actions.searchFiles"),
      shortcutLabel: getShortcutDisplayLabelById("open-file-search", platform),
      icon: <LuSearch size={16} />,
      onClick: openWorkspaceFileSearch,
    },
  ];

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
              <Typography variant="caption" color="text.secondary" component="span" aria-hidden="true">
                {action.shortcutLabel}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
