import { describe, expect, it } from "vitest";
import {
  collectSessionIdsToCloseAllTabs,
  collectSessionIdsToCloseOtherTabs,
  resolveAvailableModelsFromCapabilities,
  resolveCurrentModelFromCapabilities,
} from "./tabHelpers";

describe("tabHelpers capability parsing", () => {
  it("extracts available and current model ids from capabilities payload", () => {
    const capabilities = {
      models: {
        availableModels: [
          { id: "azure/gpt-5.3-codex", name: "GPT-5.3 Codex" },
          { modelId: "openai/o3" },
          { model: "anthropic/claude-4" },
          { name: "missing-id" },
        ],
        current: "openai/o3",
      },
    };

    expect(resolveAvailableModelsFromCapabilities(capabilities)).toEqual([
      { id: "azure/gpt-5.3-codex", name: "GPT-5.3 Codex" },
      { id: "openai/o3", name: "openai/o3" },
      { id: "anthropic/claude-4", name: "anthropic/claude-4" },
    ]);
    expect(resolveCurrentModelFromCapabilities(capabilities)).toBe("openai/o3");
  });
});

describe("tabHelpers session collection", () => {
  it("collects backend session ids for close operations", () => {
    const tabs = [
      {
        id: "tab-1",
        workspaceId: "workspace-1",
        title: "One",
        pinned: false,
        kind: "session",
        data: { sessionId: "session-1" },
      },
      {
        id: "tab-2",
        workspaceId: "workspace-1",
        title: "Two",
        pinned: false,
        kind: "session",
        data: { sessionId: "session-2" },
      },
      {
        id: "terminal-1",
        workspaceId: "workspace-1",
        title: "Terminal",
        pinned: false,
        kind: "terminal",
        data: { title: "Terminal" },
      },
      {
        id: "tab-3",
        workspaceId: "workspace-2",
        title: "Elsewhere",
        pinned: false,
        kind: "session",
        data: { sessionId: "session-3" },
      },
    ] as const;

    expect(collectSessionIdsToCloseOtherTabs(tabs, "tab-1")).toEqual(["session-2"]);
    expect(collectSessionIdsToCloseAllTabs(tabs, "tab-1")).toEqual(["session-1", "session-2"]);
  });
});
