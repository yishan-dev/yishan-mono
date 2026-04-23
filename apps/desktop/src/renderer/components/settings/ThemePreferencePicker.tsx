import { Box, Typography } from "@mui/material";
import type { AppThemeMode, AppThemePreference } from "../../theme";
import { SettingsSectionHeader } from "./SettingsPrimitives";

type ThemePreferencePickerProps = {
  preference: AppThemePreference;
  onChange: (nextPreference: AppThemePreference) => void;
  title: string;
  description: string;
  lightLabel: string;
  darkLabel: string;
  systemLabel: string;
};

type ThemeOption = {
  preference: AppThemePreference;
  label: string;
  previewMode: AppThemeMode | "system";
};

const THEME_CARD_LAYOUT = {
  width: 224,
  outerPadding: 1,
  previewGap: 1,
  titleBarHeight: 22,
  bodyHeight: 94,
  sidebarWidth: "36%",
  textLineHeight: 3,
  bubbleRadius: 1.1,
  bubbleGap: 0.45,
  chatPadX: 0.55,
  chatPadY: 0.55,
} as const;

/**
 * Resolves one palette used by the mini app-window preview for a specific theme mode.
 */
function resolveThemePreviewPalette(mode: AppThemeMode) {
  if (mode === "dark") {
    return {
      frameBorder: "#363c48",
      frameBg: "#1c2027",
      titleBarBg: "#20242d",
      titleBarText: "#c8cfdb",
      sidebarBg: "#1b1f27",
      sidebarBorder: "#323947",
      orgPillBg: "#273043",
      orgPillBorder: "#3a4456",
      repoSelectedBg: "#2d3442",
      repoPrimary: "#d6dce8",
      repoSecondary: "#8d97a8",
      mainBg: "#171b22",
      mainBorder: "#323947",
      toolbarBg: "#1f242d",
      toolbarText: "#a6afbd",
      agentBubble: "#2a313f",
      userBubble: "#2a4f8d",
      agentText: "#dbe1ec",
      userText: "#d9e8ff",
      inputBarBg: "#242a35",
      inputBarText: "#8d97a8",
    } as const;
  }

  return {
    frameBorder: "#cfd7e6",
    frameBg: "#ffffff",
    titleBarBg: "#f4f7fd",
    titleBarText: "#6e7787",
    sidebarBg: "#f8fafd",
    sidebarBorder: "#d9e0ed",
    orgPillBg: "#ffffff",
    orgPillBorder: "#cfd8e8",
    repoSelectedBg: "#e8eef9",
    repoPrimary: "#3f4a61",
    repoSecondary: "#8b96ab",
    mainBg: "#ffffff",
    mainBorder: "#dce3f0",
    toolbarBg: "#f8fafd",
    toolbarText: "#7a869a",
    agentBubble: "#eef3fb",
    userBubble: "#dce9ff",
    agentText: "#435066",
    userText: "#2a4b86",
    inputBarBg: "#f0f4fb",
    inputBarText: "#8b96ab",
  } as const;
}

/**
 * Renders one rounded text-line placeholder bar for the mini preview.
 */
function ThemePreviewTextLine({
  width,
  color,
  opacity,
}: {
  width: string;
  color: string;
  opacity?: number;
}) {
  return (
    <Box
      sx={{
        width,
        height: THEME_CARD_LAYOUT.textLineHeight,
        borderRadius: 999,
        bgcolor: color,
        opacity: opacity ?? 0.8,
      }}
    />
  );
}

/**
 * Renders one compact repository row used in the preview sidebar.
 */
function ThemePreviewRepoRow({ mode, selected = false }: { mode: AppThemeMode; selected?: boolean }) {
  const palette = resolveThemePreviewPalette(mode);

  return (
    <Box
      sx={{
        px: 0.45,
        py: 0.35,
        borderRadius: 0.9,
        bgcolor: selected ? palette.repoSelectedBg : "transparent",
      }}
    >
      <ThemePreviewTextLine width="76%" color={palette.repoPrimary} opacity={0.72} />
      <Box sx={{ mt: 0.35 }}>
        <ThemePreviewTextLine width="56%" color={palette.repoSecondary} opacity={0.7} />
      </Box>
    </Box>
  );
}

/**
 * Renders one compact chat bubble row used inside the mini preview.
 */
function ThemePreviewChatRow({
  mode,
  speaker,
  widthPercent,
}: {
  mode: AppThemeMode;
  speaker: "agent" | "user";
  widthPercent: number;
}) {
  const palette = resolveThemePreviewPalette(mode);
  const isUser = speaker === "user";
  const bubbleBg = isUser ? palette.userBubble : palette.agentBubble;
  const bubbleText = isUser ? palette.userText : palette.agentText;

  return (
    <Box sx={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <Box
        sx={{
          maxWidth: `${widthPercent}%`,
          borderRadius: THEME_CARD_LAYOUT.bubbleRadius,
          bgcolor: bubbleBg,
          px: 0.55,
          py: 0.45,
        }}
      >
        <ThemePreviewTextLine width="88%" color={bubbleText} opacity={0.85} />
        <Box sx={{ mt: 0.35 }}>
          <ThemePreviewTextLine width="62%" color={bubbleText} opacity={0.6} />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Renders one compact stylized app-window preview used inside a theme option card.
 */
function ThemePreviewWindow({ mode }: { mode: AppThemeMode }) {
  const palette = resolveThemePreviewPalette(mode);

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 1.5,
        border: 1,
        borderColor: palette.frameBorder,
        overflow: "hidden",
        bgcolor: palette.frameBg,
      }}
    >
      <Box
        sx={{
          height: THEME_CARD_LAYOUT.titleBarHeight,
          px: 0.7,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          bgcolor: palette.titleBarBg,
          borderBottom: 1,
          borderColor: palette.frameBorder,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.35,
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#ff7d73" }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#ffc965" }} />
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#79d483" }} />
        </Box>
        <Typography sx={{ fontSize: "0.46rem", lineHeight: 1, fontWeight: 600, color: palette.titleBarText }}>
          Yishan
        </Typography>
        <Box sx={{ width: 20 }} />
      </Box>
      <Box
        sx={{
          height: THEME_CARD_LAYOUT.bodyHeight,
          display: "flex",
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            width: THEME_CARD_LAYOUT.sidebarWidth,
            minWidth: THEME_CARD_LAYOUT.sidebarWidth,
            borderRight: 1,
            borderColor: palette.sidebarBorder,
            bgcolor: palette.sidebarBg,
            px: 0.45,
            py: 0.5,
          }}
        >
          <Box
            sx={{
              px: 0.45,
              py: 0.32,
              borderRadius: 999,
              border: 1,
              borderColor: palette.orgPillBorder,
              bgcolor: palette.orgPillBg,
              mb: 0.55,
            }}
          >
            <ThemePreviewTextLine width="82%" color={palette.repoPrimary} opacity={0.78} />
          </Box>
          <ThemePreviewRepoRow mode={mode} selected />
          <ThemePreviewRepoRow mode={mode} />
          <ThemePreviewRepoRow mode={mode} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, bgcolor: palette.mainBg, display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              minHeight: 14,
              borderBottom: 1,
              borderColor: palette.mainBorder,
              bgcolor: palette.toolbarBg,
              px: 0.55,
              py: 0.35,
              display: "flex",
              alignItems: "center",
            }}
          >
            <ThemePreviewTextLine width="66%" color={palette.toolbarText} opacity={0.75} />
          </Box>
          <Box
            sx={{
              flex: 1,
              px: THEME_CARD_LAYOUT.chatPadX,
              py: THEME_CARD_LAYOUT.chatPadY,
              display: "flex",
              flexDirection: "column",
              gap: THEME_CARD_LAYOUT.bubbleGap,
            }}
          >
            <ThemePreviewChatRow mode={mode} speaker="agent" widthPercent={80} />
            <ThemePreviewChatRow mode={mode} speaker="user" widthPercent={68} />
            <ThemePreviewChatRow mode={mode} speaker="agent" widthPercent={86} />
            <Box
              sx={{
                mt: "auto",
                borderRadius: 0.9,
                bgcolor: palette.inputBarBg,
                px: 0.55,
                py: 0.45,
              }}
            >
              <ThemePreviewTextLine width="78%" color={palette.inputBarText} opacity={0.7} />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Renders one preview surface that matches light, dark, or system(auto) mode visuals.
 */
function ThemePreviewSurface({ previewMode }: { previewMode: AppThemeMode | "system" }) {
  if (previewMode === "system") {
    return (
      <Box sx={{ display: "flex", gap: THEME_CARD_LAYOUT.previewGap, width: "100%" }}>
        <ThemePreviewWindow mode="light" />
        <ThemePreviewWindow mode="dark" />
      </Box>
    );
  }

  return <ThemePreviewWindow mode={previewMode} />;
}

/**
 * Renders theme preference cards (light/dark/system) for settings appearance selection.
 */
export function ThemePreferencePicker({
  preference,
  onChange,
  title,
  description,
  lightLabel,
  darkLabel,
  systemLabel,
}: ThemePreferencePickerProps) {
  const options: ThemeOption[] = [
    { preference: "light", label: lightLabel, previewMode: "light" },
    { preference: "dark", label: darkLabel, previewMode: "dark" },
    { preference: "system", label: systemLabel, previewMode: "system" },
  ];

  return (
    <Box>
      <SettingsSectionHeader title={title} description={description} />
      <Box
        sx={{
          mt: 2,
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {options.map((option) => {
          const isSelected = preference === option.preference;

          return (
            <Box
              key={option.preference}
              component="button"
              type="button"
              aria-label={option.label}
              aria-pressed={isSelected}
              data-testid={`settings-theme-option-${option.preference}`}
              onClick={() => {
                onChange(option.preference);
              }}
              sx={{
                width: THEME_CARD_LAYOUT.width,
                border: 0,
                p: 0,
                bgcolor: "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Box
                sx={{
                  p: THEME_CARD_LAYOUT.outerPadding,
                  borderRadius: 2.5,
                  border: 2,
                  borderColor: isSelected ? "primary.main" : "divider",
                  bgcolor: "background.paper",
                  boxShadow: isSelected ? (theme) => `0 0 0 1px ${theme.palette.primary.main} inset` : "none",
                }}
              >
                <ThemePreviewSurface previewMode={option.previewMode} />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.75,
                  textAlign: "center",
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? "text.primary" : "text.secondary",
                }}
              >
                {option.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
