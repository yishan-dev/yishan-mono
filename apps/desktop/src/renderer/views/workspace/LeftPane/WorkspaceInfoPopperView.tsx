import { Box, Paper, Popper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LuGitBranch, LuGitPullRequest } from "react-icons/lu";
import type { DaemonWorkspacePullRequest } from "../../../rpc/daemonTypes";
import type { RepoWorkspaceItem } from "../../../store/types";

function pullRequestStatusColor(pr: DaemonWorkspacePullRequest): string {
  const s = (pr.status ?? "").toLowerCase();
  if (pr.complete || s === "merged") {
    return "#9333ea";
  }
  if (pr.isDraft || s === "draft") {
    return "#71717a";
  }
  if (s === "closed") {
    return "#dc2626";
  }
  return "#16a34a";
}

type WorkspaceInfoPopperViewProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  workspace: RepoWorkspaceItem | undefined;
  isPrimaryWorkspace: boolean;
  /** Live current branch read from the workspace path via the daemon. */
  currentBranch?: string;
  pullRequest?: DaemonWorkspacePullRequest;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

/** Renders hover popper with workspace name and branch metadata. */
export function WorkspaceInfoPopperView({
  open,
  anchorEl,
  workspace,
  isPrimaryWorkspace,
  currentBranch,
  pullRequest,
  onMouseEnter,
  onMouseLeave,
}: WorkspaceInfoPopperViewProps) {
  const { t } = useTranslation();
  const unavailableLabel = t("workspace.info.unavailable");
  const displayBranch = currentBranch?.trim() || workspace?.branch?.trim() || unavailableLabel;
  const sourceBranch = workspace?.sourceBranch?.trim() || "";
  const shouldShowSourceBranch = !isPrimaryWorkspace && Boolean(sourceBranch);
  const sourceBranchValue = sourceBranch || unavailableLabel;
  const showSourceBranch = shouldShowSourceBranch && sourceBranchValue !== displayBranch;

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement="right-start"
      modifiers={[
        {
          name: "offset",
          options: {
            offset: [8, 0],
          },
        },
      ]}
      sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
    >
      <Paper
        data-testid="workspace-info-popper"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        elevation={4}
        sx={{
          px: 1.25,
          py: 1,
          borderRadius: 1,
          minWidth: 220,
          maxWidth: 320,
        }}
      >
        <Stack spacing={0.75}>
          <Typography
            variant="subtitle2"
            sx={{
              lineHeight: 1.2,
              color: "text.primary",
            }}
            noWrap
          >
            {workspace?.name}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <LuGitBranch size={14} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              <Box component="span" sx={{ textTransform: "uppercase", letterSpacing: 0.4, color: "info.main" }}>
                {t("workspace.info.branch")}:
              </Box>{" "}
              {displayBranch}
            </Typography>
          </Stack>
          {showSourceBranch ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LuGitBranch size={14} />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                <Box component="span" sx={{ textTransform: "uppercase", letterSpacing: 0.4, color: "info.main" }}>
                  {t("workspace.info.sourceBranch")}:
                </Box>{" "}
                {sourceBranchValue}
              </Typography>
            </Stack>
          ) : null}
          {pullRequest ? (
            <Stack spacing={0.25} sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 0.4, color: "text.primary", lineHeight: 1.2 }}>
                {t("workspace.pr.tab")}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <LuGitPullRequest size={14} color={pullRequestStatusColor(pullRequest)} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }} noWrap>
                  #{pullRequest.number}
                  {pullRequest.title ? ` ${pullRequest.title}` : ""}
                </Typography>
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Popper>
  );
}
