import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { ImageAddon } from "@xterm/addon-image";
import { SearchAddon } from "@xterm/addon-search";
import { WebFontsAddon } from "@xterm/addon-web-fonts";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import type { ITerminalAddon, Terminal } from "@xterm/xterm";
import { openExternalUrl } from "../../commands/appCommands";

type Logger = Pick<Console, "warn">;

export type TerminalAddons = {
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
};

/**
 * Loads stable terminal addons and returns the fit/search addons used by the view.
 */
export function loadTerminalAddons(terminal: Pick<Terminal, "loadAddon">, logger: Logger = console): TerminalAddons {
  const fitAddon = new FitAddon();
  const searchAddon = new SearchAddon({
    highlightLimit: 1_000,
  });

  loadAddonSafely(terminal, fitAddon, logger, "fit");
  loadAddonSafely(terminal, searchAddon, logger, "search");
  loadWebglAddonWithFallback(terminal, logger);
  loadAddonSafely(terminal, new ClipboardAddon(), logger, "clipboard");
  loadAddonSafely(terminal, new ImageAddon(), logger, "image");
  loadAddonSafely(terminal, new WebFontsAddon(), logger, "web-fonts");
  loadAddonSafely(
    terminal,
    new WebLinksAddon((event, uri) => void openExternalLink(event, uri, logger)),
    logger,
    "web-links",
  );
  return {
    fitAddon,
    searchAddon,
  };
}

/**
 * Loads the WebGL renderer addon with automatic context-loss recovery.
 * When the WebGL context is lost, the addon is disposed and a new instance
 * is loaded after a brief delay. This avoids falling back to the slow DOM renderer.
 */
function loadWebglAddonWithFallback(terminal: Pick<Terminal, "loadAddon">, logger: Logger): void {
  const loadWebgl = () => {
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => {
      logger.warn("xterm WebGL context lost, reloading WebGL addon");
      try {
        webglAddon.dispose();
      } catch {
        // Ignore dispose errors during context loss.
      }
      // Re-create after a short delay to allow GPU recovery.
      setTimeout(() => loadWebgl(), 500);
    });
    loadAddonSafely(terminal, webglAddon, logger, "webgl");
  };

  loadWebgl();
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
