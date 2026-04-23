// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_SETTINGS_STORE_STORAGE_KEY, agentSettingsStore } from "../../store/agentSettingsStore";
import { AgentSettingsView } from "./AgentSettingsView";

const mocked = vi.hoisted(() => ({
  listAgentDetectionStatuses: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../hooks/useCommands", () => ({
  useCommands: () => ({
    listAgentDetectionStatuses: mocked.listAgentDetectionStatuses,
  }),
}));

describe("AgentSettingsView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.removeItem(AGENT_SETTINGS_STORE_STORAGE_KEY);
    agentSettingsStore.setState({
      inUseByAgentKind: {
        opencode: true,
        codex: true,
        claude: true,
      },
    });
  });

  it("renders detected statuses and updates in-use toggle state", async () => {
    mocked.listAgentDetectionStatuses.mockResolvedValueOnce([
      { agentKind: "opencode", detected: true },
      { agentKind: "codex", detected: false },
      { agentKind: "claude", detected: true },
    ]);

    render(<AgentSettingsView />);

    expect(await screen.findByText("settings.agents.items.opencode")).toBeTruthy();
    expect(screen.getAllByText("settings.agents.status.detected").length).toBe(2);
    expect(screen.getByText("settings.agents.status.notDetected")).toBeTruthy();

    const codexSwitch = screen.getByRole("checkbox", {
      name: "settings.agents.items.codex settings.agents.inUse",
    }) as HTMLInputElement;
    expect(codexSwitch.checked).toBe(true);

    fireEvent.click(codexSwitch);

    expect(agentSettingsStore.getState().inUseByAgentKind.codex).toBe(false);
  });

  it("shows load error when detection query fails", async () => {
    mocked.listAgentDetectionStatuses.mockRejectedValueOnce(new Error("boom"));

    render(<AgentSettingsView />);

    expect(await screen.findByText("settings.agents.loadError")).toBeTruthy();
  });

  it("keeps recheck clickable during initial load and only disables while recheck is running", async () => {
    let resolveInitialLoad: (value: Array<{ agentKind: string; detected: boolean }>) => void = () => {};
    mocked.listAgentDetectionStatuses
      .mockImplementationOnce(
        () =>
          new Promise<Array<{ agentKind: string; detected: boolean }>>((resolve) => {
            resolveInitialLoad = resolve;
          }),
      )
      .mockResolvedValueOnce([
        { agentKind: "opencode", detected: true },
        { agentKind: "codex", detected: true },
        { agentKind: "claude", detected: true },
      ]);

    render(<AgentSettingsView />);

    const recheckButton = screen.getByRole("button", { name: "settings.agents.actions.recheckAll" });
    expect(recheckButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(recheckButton);

    expect(recheckButton.hasAttribute("disabled")).toBe(true);
    await waitFor(() => {
      expect(recheckButton.hasAttribute("disabled")).toBe(false);
    });

    resolveInitialLoad([
      { agentKind: "opencode", detected: true },
      { agentKind: "codex", detected: false },
      { agentKind: "claude", detected: true },
    ]);
  });
});
