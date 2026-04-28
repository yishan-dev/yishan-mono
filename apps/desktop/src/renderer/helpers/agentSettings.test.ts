import { describe, expect, it } from "vitest";
import { getAgentIconPresentation } from "./agentSettings";

describe("getAgentIconPresentation", () => {
  it("renders the white Copilot asset as black in light mode", () => {
    const icon = getAgentIconPresentation("copilot", "tabMenu");

    expect(icon.filterByTheme.light).toBe("brightness(0) saturate(100%)");
  });

  it("keeps agent icons monochrome white in dark mode", () => {
    const icon = getAgentIconPresentation("copilot", "tabMenu");

    expect(icon.filterByTheme.dark).toBe("brightness(0) saturate(100%) invert(1)");
  });
});
