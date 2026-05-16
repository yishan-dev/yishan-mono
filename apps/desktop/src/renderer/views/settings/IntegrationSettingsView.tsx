import { Alert, Box, Button, Chip, CircularProgress } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiLogoGithub } from "react-icons/bi";
import type { GitHubConnectionStatus } from "../../commands/integrationCommands";
import { SettingsCard, SettingsControlRow, SettingsRows, SettingsSectionHeader } from "../../components/settings";
import { withTimeout } from "../../helpers/withTimeout";
import { useCommands } from "../../hooks/useCommands";
import { useLatestRequestGuard } from "../../hooks/useLatestRequestGuard";

const GITHUB_STATUS_TIMEOUT_MS = 15_000;
const RECHECK_MIN_DURATION_MS = 500;

/** Renders the Integrations settings view with connection status for external services. */
export function IntegrationSettingsView() {
  const { t } = useTranslation();
  const { checkGitHubConnectionStatus } = useCommands();
  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const requestGuard = useLatestRequestGuard();

  /** Loads current GitHub connection status from the daemon. */
  const loadGitHubStatus = useCallback(
    async (isManualRefresh: boolean) => {
      const loadId = requestGuard.beginRequest();
      const isLatestMountedLoad = () => requestGuard.isCurrentRequest(loadId);
      const refreshStartedAt = isManualRefresh ? Date.now() : null;

      if (isManualRefresh) {
        setIsRefreshing(true);
      }

      setHasLoadError(false);

      try {
        const status = await withTimeout(
          checkGitHubConnectionStatus(isManualRefresh),
          GITHUB_STATUS_TIMEOUT_MS,
          `GitHub status check timed out after ${GITHUB_STATUS_TIMEOUT_MS}ms`,
        );
        if (!isLatestMountedLoad()) {
          return;
        }
        setGithubStatus(status);
      } catch (error) {
        console.error("[IntegrationSettingsView] Failed to load GitHub status", error);
        if (!isLatestMountedLoad()) {
          return;
        }
        setHasLoadError(true);
      } finally {
        if (refreshStartedAt !== null) {
          const elapsedMs = Date.now() - refreshStartedAt;
          const remainingMs = RECHECK_MIN_DURATION_MS - elapsedMs;
          if (remainingMs > 0) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, remainingMs);
            });
          }
        }

        if (isLatestMountedLoad()) {
          if (isManualRefresh) {
            setIsRefreshing(false);
          }
          setIsLoading(false);
        }
      }
    },
    [checkGitHubConnectionStatus, requestGuard],
  );

  useEffect(() => {
    void loadGitHubStatus(false);
  }, [loadGitHubStatus]);

  const isStatusPending = githubStatus === null && (isLoading || isRefreshing) && !hasLoadError;

  const githubStatusLabel = isStatusPending
    ? t("settings.integrations.status.checking")
    : githubStatus?.loggedIn
      ? githubStatus.username
        ? t("settings.integrations.github.connectedAs", { username: githubStatus.username })
        : t("settings.integrations.status.connected")
      : githubStatus?.installed
        ? t("settings.integrations.github.notLoggedIn")
        : t("settings.integrations.github.notInstalled");

  const githubStatusColor = isStatusPending ? "default" : githubStatus?.loggedIn ? "success" : "default";

  const githubStatusVariant = isStatusPending ? "outlined" : githubStatus?.loggedIn ? "filled" : "outlined";

  return (
    <Box>
      <SettingsSectionHeader
        title={t("settings.integrations.title")}
        description={t("settings.integrations.description")}
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              void loadGitHubStatus(true);
            }}
            disabled={isRefreshing}
            startIcon={isRefreshing || isLoading ? <CircularProgress size={14} /> : null}
          >
            {t("settings.integrations.actions.recheckAll")}
          </Button>
        }
      />
      <SettingsCard>
        {hasLoadError ? <Alert severity="error">{t("settings.integrations.loadError")}</Alert> : null}
        <SettingsRows>
          <SettingsControlRow
            title={
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                <BiLogoGithub size={18} />
                <Box component="span">{t("settings.integrations.github.label")}</Box>
              </Box>
            }
            description={t("settings.integrations.github.description")}
            control={
              <Chip size="small" label={githubStatusLabel} color={githubStatusColor} variant={githubStatusVariant} />
            }
          />
        </SettingsRows>
      </SettingsCard>
    </Box>
  );
}
