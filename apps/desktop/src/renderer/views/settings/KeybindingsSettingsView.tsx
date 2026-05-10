import { Stack } from "@mui/material";
import { useTranslation } from "react-i18next";
import { KeybindingTable } from "../../components/KeybindingDisplay";
import { SettingsSectionHeader } from "../../components/settings";
import { SUPPORTED_KEY_BINDINGS } from "../../shortcuts/keybindings";

export function KeybindingsSettingsView() {
  const { t } = useTranslation();

  return (
    <Stack spacing={2.5}>
      <SettingsSectionHeader title={t("keybindings.title")} description={t("keybindings.subtitle")} />

      <KeybindingTable
        bindings={SUPPORTED_KEY_BINDINGS}
        actionColumnLabel={t("keybindings.columns.action")}
        keyColumnLabel={t("keybindings.columns.current")}
      />
    </Stack>
  );
}
