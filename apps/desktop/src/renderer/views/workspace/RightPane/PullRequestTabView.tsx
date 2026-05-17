import { Box, Button, Chip, Divider, LinearProgress, Link, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuGitBranch, LuGitPullRequest } from "react-icons/lu";
import { openLink } from "../../../commands/appCommands";
import type { DaemonWorkspacePullRequest } from "../../../rpc/daemonTypes";
import { useWorkspacePullRequestState } from "./useWorkspacePullRequestState";

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

function BranchBadge({ name }: { name: string }) {
  return (
    <Box
      title={name}
      sx={{
        color: "text.secondary",
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.625,
        py: 0.375,
        border: 1,
        borderColor: "divider",
        borderRadius: 0.75,
        boxSizing: "border-box",
      }}
    >
      <LuGitBranch size={12} color="currentColor" />
      <Typography
        variant="caption"
        component="span"
        sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {name}
      </Typography>
    </Box>
  );
}

/** Renders pull request, checks, and deployment details for the selected workspace. */
export function PullRequestTabView({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const { pullRequest, isLoading } = useWorkspacePullRequestState(active);

  if (isLoading) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
        <LinearProgress sx={{ width: 120, height: 3, borderRadius: 999, overflow: "hidden" }} />
      </Box>
    );
  }

  if (!pullRequest) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", px: 3 }}>
        <Typography variant="body2" sx={{ color: "#999" }}>
          {t("workspace.pr.empty")}
        </Typography>
      </Box>
    );
  }

  const checks = pullRequest.checks ?? [];
  const deployments = pullRequest.deployments ?? [];
  const iconColor = pullRequestStatusColor(pullRequest);

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", px: 2, py: 1.5 }}>
      <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LuGitPullRequest size={18} color={iconColor} />
            <Typography variant="subtitle1" noWrap>
              #{pullRequest.number}
              {pullRequest.title ? ` ${pullRequest.title}` : ""}
            </Typography>
          </Stack>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, overflow: "hidden", mt: 0.25 }}>
            <BranchBadge name={pullRequest.branch || t("workspace.info.unavailable")} />
            <Box sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
              <LuArrowRight size={13} color="currentColor" />
            </Box>
            <BranchBadge name={pullRequest.baseBranch || t("workspace.info.unavailable")} />
          </Box>
          {pullRequest.url ? (
            <Link
              component="button"
              type="button"
              underline="hover"
              variant="body2"
              onClick={() => void openLink({ url: pullRequest.url ?? "" })}
              sx={{ alignSelf: "flex-start" }}
            >
              {t("workspace.pr.viewDetails")}
            </Link>
          ) : null}
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle2">{t("workspace.pr.checks")}</Typography>
          {checks.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#999" }}>
              {t("workspace.pr.noChecks")}
            </Typography>
          ) : (
            checks.map((check) => (
              <Stack key={`${check.workflow ?? ""}:${check.name}`} direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={check.state} variant="outlined" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {check.workflow ? `${check.workflow} / ${check.name}` : check.name}
                  </Typography>
                  {check.description ? (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {check.description}
                    </Typography>
                  ) : null}
                </Box>
                {check.url ? (
                  <Button size="small" onClick={() => void openLink({ url: check.url ?? "" })}>{t("workspace.pr.open")}</Button>
                ) : null}
              </Stack>
            ))
          )}
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography variant="subtitle2">{t("workspace.pr.deployments")}</Typography>
          {deployments.length === 0 ? (
            <Typography variant="body2" sx={{ color: "#999" }}>
              {t("workspace.pr.noDeployments")}
            </Typography>
          ) : (
            deployments.map((deployment) => (
              <Stack key={deployment.id} direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={deployment.state || t("workspace.info.unavailable")} variant="outlined" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {deployment.environment || t("workspace.info.unavailable")}
                  </Typography>
                  {deployment.description ? (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {deployment.description}
                    </Typography>
                  ) : null}
                </Box>
                {deployment.environmentUrl ? (
                  <Button size="small" onClick={() => void openLink({ url: deployment.environmentUrl ?? "" })}>{t("workspace.pr.open")}</Button>
                ) : null}
              </Stack>
            ))
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
