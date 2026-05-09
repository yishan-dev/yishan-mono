import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { SettingsSectionHeader } from "../../components/settings";
import { getRendererPlatform } from "../../helpers/platform";
import { SUPPORTED_KEY_BINDINGS, type SupportedKeyBinding } from "../../shortcuts/keybindings";

function HotkeyDisplay({ keys }: { keys: readonly string[] }) {
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
      {keys.map((key, index) => (
        <Stack key={key} direction="row" spacing={0.5} alignItems="center">
          {index > 0 ? (
            <Typography variant="caption" color="text.secondary" aria-hidden="true">
              +
            </Typography>
          ) : null}
          <Box
            component="kbd"
            sx={{
              px: 0.75,
              py: 0.3,
              borderRadius: 0.5,
              border: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              typography: "caption",
              fontFamily: "monospace",
              lineHeight: 1.2,
            }}
          >
            {key}
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

function KeybindingRow({ binding }: { binding: SupportedKeyBinding }) {
  const { t } = useTranslation();
  const platform = getRendererPlatform();
  const keys = platform === "darwin" ? binding.macKeys : binding.windowsKeys;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
        gap: 1,
        alignItems: "center",
        px: 1.5,
        py: 1.2,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box>
        <Typography variant="body2" color="text.primary">
          {t(binding.descriptionKey)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {binding.scope === "global" ? t("keybindings.scope.global") : t("keybindings.scope.workspace")}
        </Typography>
      </Box>
      <HotkeyDisplay keys={keys} />
    </Box>
  );
}

export function KeybindingsSettingsView() {
  const { t } = useTranslation();

  return (
    <Stack spacing={2.5}>
      <SettingsSectionHeader title={t("keybindings.title")} description={t("keybindings.subtitle")} />

      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "background.default",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
            gap: 1,
            px: 1.5,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t("keybindings.columns.action")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t("keybindings.columns.current")}
          </Typography>
        </Box>
        {SUPPORTED_KEY_BINDINGS.map((binding) => (
          <KeybindingRow key={binding.id} binding={binding} />
        ))}
      </Box>
    </Stack>
  );
}
