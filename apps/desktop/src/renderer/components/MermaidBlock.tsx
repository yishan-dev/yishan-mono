import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

type MermaidBlockProps = {
  code: string;
};

/** Renders a Mermaid diagram from a code string, with theme-aware styling and error handling. */
export function MermaidBlock({ code }: MermaidBlockProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uniqueId = useId().replace(/:/g, "-");
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    if (!containerRef.current || !code.trim()) return;

    let cancelled = false;

    const renderDiagram = async () => {
      // Re-initialize mermaid with the current theme on every render
      // to handle light/dark mode switches.
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: isDark
          ? {
              primaryColor: "#3f51b5",
              primaryTextColor: "#e0e0e0",
              primaryBorderColor: "#5c6bc0",
              lineColor: "#7986cb",
              secondaryColor: "#1a237e",
              tertiaryColor: "#283593",
              background: "#121212",
              mainBkg: "#1e1e1e",
              nodeBorder: "#5c6bc0",
              clusterBkg: "#1a1a2e",
              titleColor: "#e0e0e0",
              edgeLabelBackground: "#2d2d2d",
            }
          : undefined,
        fontFamily: theme.typography.fontFamily as string,
        fontSize: 14,
      });

      const diagramId = `mermaid-${uniqueId}-${Date.now()}`;

      try {
        const { svg } = await mermaid.render(diagramId, code.trim());
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          // Clean up any leftover error element mermaid may have inserted
          const errorElement = document.getElementById(`d${diagramId}`);
          errorElement?.remove();

          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, isDark, uniqueId, theme.typography.fontFamily]);

  if (!code.trim()) {
    return null;
  }

  if (error) {
    return (
      <Box
        sx={{
          my: 1.5,
          p: 2,
          borderRadius: 1,
          border: 1,
          borderColor: "error.main",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(211, 47, 47, 0.08)" : "rgba(211, 47, 47, 0.04)",
        }}
      >
        <Typography variant="caption" color="error.main" sx={{ fontWeight: 500 }}>
          Mermaid diagram error
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.5,
            fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
            fontSize: "0.75em",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        my: 1.5,
        display: "flex",
        justifyContent: "center",
        overflow: "auto",
        "& svg": {
          maxWidth: "100%",
          height: "auto",
        },
      }}
    />
  );
}
