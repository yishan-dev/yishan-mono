import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { SearchAddon } from "@xterm/addon-search";
import { WebFontsAddon } from "@xterm/addon-web-fonts";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { ITerminalAddon, Terminal } from "@xterm/xterm";
import { openExternalUrl } from "../../../commands/appCommands";

type Logger = Pick<Console, "warn">;

export type TerminalAddons = {
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
};

/**
 * Once WebGL fails to initialize on any terminal, all subsequent terminals
 * skip the WebGL attempt and use the default DOM renderer. This avoids
 * repeated GPU context creation failures (mirrors VS Code behavior).
 */
let suggestedRendererType: "webgl" | "dom" = "webgl";

/**
 * Loads all terminal addons and returns the fit/search addons used by the view.
 *
 * IMPORTANT: Must be called **after** `terminal.open()` so xterm's internal
 * viewport and link layer are fully initialized before addons access them.
 */
export function loadTerminalAddons(terminal: Pick<Terminal, "loadAddon">, logger: Logger = console): TerminalAddons {
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon({
    highlightLimit: 1_000,
  });

  loadAddonSafely(terminal, fitAddon, logger, "fit");
  loadAddonSafely(terminal, searchAddon, logger, "search");
  loadAddonSafely(terminal, new ClipboardAddon(), logger, "clipboard");
  loadAddonSafely(terminal, new ImageAddon(), logger, "image");
  loadAddonSafely(terminal, new WebFontsAddon(), logger, "web-fonts");
  loadAddonSafely(
    terminal,
    new WebLinksAddon((event, uri) => void openExternalLink(event, uri, logger)),
    logger,
    "web-links",
  );
  loadWebglAddonWithFallback(terminal, logger);

  return {
    fitAddon,
    searchAddon,
  };
}

/**
 * Loads the WebGL renderer addon with automatic context-loss recovery.
 * When the WebGL context is lost, the addon is disposed and a new instance
 * is loaded after a brief delay. If WebGL has previously failed on any terminal,
 * skips the attempt entirely and falls back to the DOM renderer.
 */
function loadWebglAddonWithFallback(terminal: Pick<Terminal, "loadAddon">, logger: Logger): void {
  if (suggestedRendererType !== "webgl") {
    return;
  }

  const webglAddon = new WebglAddon();
  webglAddon.onContextLoss(() => {
    logger.warn("xterm WebGL context lost, reloading WebGL addon");
    try {
      webglAddon.dispose();
    } catch {
      // Ignore dispose errors during context loss.
    }
    // Re-create after a short delay to allow GPU recovery.
    setTimeout(() => {
      loadWebglAddonWithFallback(terminal, logger);
    }, 500);
  });

  if (!loadAddonSafely(terminal, webglAddon, logger, "webgl")) {
    // WebGL failed to initialize — mark globally so other terminals skip it.
    suggestedRendererType = "dom";
  }
}

/** Safely loads an addon and logs a warning when the addon fails to initialize. */
function loadAddonSafely(
  terminal: Pick<Terminal, "loadAddon">,
  addon: ITerminalAddon,
  logger: Logger,
  addonName: string,
): boolean {
  try {
    terminal.loadAddon(addon);
    return true;
  } catch (error) {
    logger.warn(`Failed to load xterm ${addonName} addon`, error);
    return false;
  }
}

/** Opens one xterm web link through the desktop host bridge. */
async function openExternalLink(event: MouseEvent, uri: string, logger: Logger): Promise<void> {
  event.preventDefault();
  try {
    const result = await openExternalUrl(uri);
    if (!result.opened) {
      logger.warn(`Failed to open xterm external link (${result.reason})`, { uri });
    }
  } catch (error) {
    logger.warn("Failed to open xterm external link", error);
  }
}
