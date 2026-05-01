import { Alert, Box, Button, Chip, CircularProgress, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DaemonInfoResult } from "../../../main/ipc";
import { SettingsCard, SettingsControlRow, SettingsRows, SettingsSectionHeader } from "../../components/settings";
import { getDesktopHostBridge } from "../../rpc/rpcTransport";

/** Renders one settings panel for inspecting the local daemon connection. */
export function DaemonSettingsView() {
  const { t } = useTranslation();
  const [daemonInfo, setDaemonInfo] = useState<DaemonInfoResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const latestLoadIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const loadDaemonInfo = useCallback(async (isManualRefresh: boolean) => {
    const loadId = latestLoadIdRef.current + 1;
    latestLoadIdRef.current = loadId;
    const isLatestMountedLoad = () => isMountedRef.current && latestLoadIdRef.current === loadId;

    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setHasLoadError(false);

    try {
      const info = await getDesktopHostBridge().getDaemonInfo();
      if (!isLatestMountedLoad()) {
        return;
      }
      setDaemonInfo(info);
    } catch (error) {
      console.error("[DaemonSettingsView] Failed to load daemon info", error);
      if (!isLatestMountedLoad()) {
        return;
      }
      setDaemonInfo(null);
      setHasLoadError(true);
    } finally {
      if (isLatestMountedLoad()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadDaemonInfo(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDaemonInfo]);

  const statusLabel = daemonInfo ? t("settings.daemon.status.running") : t("settings.daemon.status.unavailable");

  return (
    <Box>
      <SettingsSectionHeader
        title={t("settings.daemon.title")}
        description={t("settings.daemon.description")}
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              void loadDaemonInfo(true);
            }}
            disabled={isRefreshing || isLoading}
            startIcon={isRefreshing || isLoading ? <CircularProgress size={14} /> : null}
          >
            {t("settings.daemon.actions.refresh")}
          </Button>
        }
      />
      <SettingsCard>
        {isLoading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <>
            {hasLoadError ? <Alert severity="error">{t("settings.daemon.loadError")}</Alert> : null}
            <SettingsRows>
              <SettingsControlRow
                title={t("settings.daemon.rows.status")}
                control={
                  <Chip
                    size="small"
                    label={statusLabel}
                    color={daemonInfo ? "success" : "default"}
                    variant={daemonInfo ? "filled" : "outlined"}
                  />
                }
              />
              <SettingsControlRow
                title={t("settings.daemon.rows.version")}
                control={
                  <Typography variant="body2">{daemonInfo?.version || t("settings.daemon.values.unknown")}</Typography>
                }
              />
              <SettingsControlRow
                title={t("settings.daemon.rows.id")}
                control={
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {daemonInfo?.daemonId || t("settings.daemon.values.unknown")}
                  </Typography>
                }
              />
              <SettingsControlRow
                title={t("settings.daemon.rows.websocket")}
                control={
                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                    {daemonInfo?.wsUrl || t("settings.daemon.values.unknown")}
                  </Typography>
                }
              />
            </SettingsRows>
          </>
        )}
      </SettingsCard>
    </Box>
  );
}
