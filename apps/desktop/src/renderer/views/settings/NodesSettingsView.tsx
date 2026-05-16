import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CenteredSpinner } from "../../components/CenteredSpinner";
import { StatusIndicator } from "../../components/StatusIndicator";
import { SettingsCard, SettingsSectionHeader } from "../../components/settings";
import { api } from "../../api/client";
import type { NodeRecord, OrganizationMemberRecord } from "../../api/types";
import { sessionStore } from "../../store/sessionStore";

function resolveOwnerLabel(node: NodeRecord, members: OrganizationMemberRecord[], fallbackLabel: string): string {
  if (!node.ownerUserId) {
    return fallbackLabel;
  }

  const member = members.find((entry) => entry.userId === node.ownerUserId);
  if (!member) {
    return fallbackLabel;
  }

  return member.name?.trim() || member.email;
}

function resolveNodeVersion(node: NodeRecord, fallbackLabel: string): string {
  const version = node.metadata?.version;
  return typeof version === "string" && version.trim() ? version : fallbackLabel;
}

function resolveNodeTypeLabel(node: NodeRecord, privateLabel: string, sharedLabel: string): string {
  return node.scope === "shared" ? sharedLabel : privateLabel;
}

export function NodesSettingsView() {
  const { t } = useTranslation();
  const selectedOrganizationId = sessionStore((state) => state.selectedOrganizationId);
  const organizations = sessionStore((state) => state.organizations);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);

  useEffect(() => {
    const organizationId = selectedOrganizationId ?? organizations[0]?.id;
    if (!organizationId) {
      setNodes([]);
      setMembers([]);
      setHasLoadError(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setHasLoadError(false);

      try {
        const [nextNodes, nextMembers] = await Promise.all([
          api.node.listByOrg(organizationId),
          api.org.listMembers(organizationId),
        ]);

        if (cancelled) {
          return;
        }

        setNodes(nextNodes);
        setMembers(nextMembers);
      } catch (error) {
        console.error("[NodesSettingsView] Failed to load organization nodes", error);
        if (!cancelled) {
          setNodes([]);
          setMembers([]);
          setHasLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [organizations, selectedOrganizationId]);

  return (
    <Box>
      <SettingsSectionHeader title={t("settings.nodes.title")} description={t("settings.nodes.description")} />
      <SettingsCard>
        {isLoading ? (
          <CenteredSpinner />
        ) : (
          <>
            {hasLoadError ? <Alert severity="error">{t("settings.nodes.loadError")}</Alert> : null}
            <Table
              size="small"
              sx={{
                mt: hasLoadError ? 1.5 : 0,
                "& th": {
                  fontWeight: 600,
                  borderBottomColor: "divider",
                },
                "& th, & td": {
                  borderBottomColor: "divider",
                },
                "& tbody tr:last-of-type td": {
                  borderBottom: "none",
                },
              }}
            >
                <TableHead>
                  <TableRow>
                    <TableCell>{t("settings.nodes.columns.name")}</TableCell>
                    <TableCell>{t("settings.nodes.columns.type")}</TableCell>
                    <TableCell>{t("settings.nodes.columns.version")}</TableCell>
                    <TableCell>{t("settings.nodes.columns.owner")}</TableCell>
                    <TableCell>{t("settings.nodes.columns.status")}</TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {nodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                        {t("settings.nodes.empty")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  nodes.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell>{node.name}</TableCell>
                      <TableCell>
                        {resolveNodeTypeLabel(
                          node,
                          t("settings.nodes.types.private"),
                          t("settings.nodes.types.shared")
                        )}
                      </TableCell>
                      <TableCell>{resolveNodeVersion(node, t("settings.nodes.values.unknownVersion"))}</TableCell>
                      <TableCell>{resolveOwnerLabel(node, members, t("settings.nodes.values.unknownOwner"))}</TableCell>
                      <TableCell>
                        <StatusIndicator
                          label={node.isOnline ? t("settings.nodes.status.online") : t("settings.nodes.status.offline")}
                          color={node.isOnline ? "success" : "disabled"}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </>
        )}
      </SettingsCard>
    </Box>
  );
}
