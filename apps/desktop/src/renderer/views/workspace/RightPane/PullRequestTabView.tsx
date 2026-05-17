import { Box, Chip, Divider, LinearProgress, Link, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { LuArrowRight, LuGitBranch } from "react-icons/lu";
import { openLink } from "../../../commands/appCommands";
import type { WorkspacePullRequestRecord } from "../../../api/types";
import type { DaemonWorkspacePullRequest } from "../../../rpc/daemonTypes";
import { PullRequestIcon, pullRequestStateColor } from "../../../components/PullRequestIcon";
import { useWorkspacePullRequestState } from "./useWorkspacePullRequestState";

function livePrStatus(pr: DaemonWorkspacePullRequest): string {
  const s = (pr.status ?? "").toLowerCase();
  if (pr.complete || s === "merged") return "merged";
  if (pr.isDraft || s === "draft") return "draft";
  if (s === "closed") return "closed";
  return "open";
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

function HistoricalPullRequestRow({ pr }: { pr: WorkspacePullRequestRecord }) {
  const { t } = useTranslation();
  const isDraft = (pr.metadata as Record<string, unknown> | null)?.isDraft as boolean | undefined;

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <PullRequestIcon state={pr.state} isDraft={isDraft} size={15} />
        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          #{pr.prId}{pr.title ? ` ${pr.title}` : ""}
        </Typography>
        <Chip
          size="small"
          label={pr.state}
          variant="outlined"
          sx={{ flexShrink: 0, fontSize: 11, height: 20 }}
        />
      </Stack>
      {(pr.branch || pr.baseBranch) ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, overflow: "hidden" }}>
          <BranchBadge name={pr.branch || t("workspace.info.unavailable")} />
          <Box sx={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}>
            <LuArrowRight size={13} color="currentColor" />
          </Box>
          <BranchBadge name={pr.baseBranch || t("workspace.info.unavailable")} />
        </Box>
      ) : null}
      {pr.url ? (
        <Link
          component="button"
          type="button"
          underline="hover"
          variant="caption"
          onClick={() => void openLink({ url: pr.url ?? "" })}
          sx={{ alignSelf: "flex-start" }}
        >
          {t("workspace.pr.viewDetails")}
        </Link>
      ) : null}
    </Stack>
  );
}

/** Renders pull request, checks, and deployment details for the selected workspace. */
export function PullRequestTabView({ active = true }: { active?: boolean }) {
  const { t } = useTranslation();
  const { pullRequest, historicalPullRequests, isLoading } = useWorkspacePullRequestState(active);

  const hasLivePr = Boolean(pullRequest);
  const checks = pullRequest?.checks ?? [];
  const deployments = pullRequest?.deployments ?? [];
  const livePrId = pullRequest?.number != null ? String(pullRequest.number) : null;
  const pastPullRequests = historicalPullRequests.filter((pr) => pr.prId !== livePrId);
  const hasHistory = pastPullRequests.length > 0;
  const isEmpty = !hasLivePr && !hasHistory;

  if (isLoading && isEmpty) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
        <LinearProgress sx={{ width: 120, height: 3, borderRadius: 999, overflow: "hidden" }} />
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", px: 3 }}>
        <Typography variant="body2" sx={{ color: "#999" }}>
          {t("workspace.pr.empty")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", px: 2, py: 1.5 }}>
      <Stack spacing={2}>

        {/* ── Live PR (from daemon) ── */}
        {pullRequest ? (
          <>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PullRequestIcon state={livePrStatus(pullRequest)} size={18} />
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
                    <Box sx={{ minWidth: 0, flex: 1 }}>
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
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        variant="caption"
                        onClick={() => void openLink({ url: check.url ?? "" })}
                        sx={{ flexShrink: 0 }}
                      >
                        {t("workspace.pr.open")}
                      </Link>
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
                    <Box sx={{ minWidth: 0, flex: 1 }}>
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
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        variant="caption"
                        onClick={() => void openLink({ url: deployment.environmentUrl ?? "" })}
                        sx={{ flexShrink: 0 }}
                      >
                        {t("workspace.pr.open")}
                      </Link>
                    ) : null}
                  </Stack>
                ))
              )}
            </Stack>
          </>
        ) : null}

        {/* ── Historical PRs (from api-service) ── */}
        {hasHistory ? (
          <>
            {pullRequest ? <Divider /> : null}
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
                {t("workspace.pr.history")}
              </Typography>
            </Stack>
            <Stack spacing={1.5} divider={<Divider />}>
              {pastPullRequests.map((pr) => (
                <HistoricalPullRequestRow key={pr.id} pr={pr} />
              ))}
            </Stack>
          </>
        ) : null}

      </Stack>
    </Box>
  );
}
