// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchView } from "./LaunchView";

const mocks = vi.hoisted(() => ({
  openTab: vi.fn(),
  openWorkspaceFileSearch: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "launch.title": "No tabs open",
        "launch.hint": "Select an action to get started.",
        "launch.actions.openTerminal": "Open terminal",
        "launch.actions.searchFiles": "Search files",
        "terminal.title": "Terminal",
      };

      return translations[key] ?? key;
    },
  }),
}));

vi.mock("../../hooks/useCommands", () => ({
  useCommands: () => ({
    openTab: mocks.openTab,
    openWorkspaceFileSearch: mocks.openWorkspaceFileSearch,
  }),
}));

vi.mock("../../helpers/platform", () => ({
  getRendererPlatform: () => "darwin",
}));

vi.mock("../../shortcuts/shortcutDisplay", () => ({
  getShortcutDisplayLabelById: (id: string) => {
    if (id === "open-terminal") {
      return "⌘+T";
    }
    if (id === "open-file-search") {
      return "⌘+P";
    }

    return null;
  },
}));

vi.mock("../../store/workspaceStore", () => ({
  workspaceStore: (selector: (state: { selectedWorkspaceId: string }) => unknown) =>
    selector({ selectedWorkspaceId: "workspace-1", workspaces: [] } as never),
}));

describe("LaunchView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows shortcut labels for launch actions", () => {
    render(<LaunchView />);

    expect(screen.getByText("⌘+T")).toBeTruthy();
    expect(screen.getByText("⌘+P")).toBeTruthy();
  });

  it("runs launch actions when clicked", () => {
    render(<LaunchView />);

    fireEvent.click(screen.getByRole("button", { name: "Open terminal" }));
    fireEvent.click(screen.getByRole("button", { name: "Search files" }));

    expect(mocks.openTab).toHaveBeenCalledTimes(1);
    expect(mocks.openWorkspaceFileSearch).toHaveBeenCalledTimes(1);
  });
});
