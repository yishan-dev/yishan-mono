import { describe, expect, it } from "vitest";
import { countWorkspaceGitChanges, normalizeCreateWorkspaceInput } from "./workspaceHelpers";

describe("workspaceHelpers", () => {
  it("normalizes create-workspace input and applies defaults", () => {
    expect(
      normalizeCreateWorkspaceInput({
        name: "  feature-a  ",
      }),
    ).toEqual({
      normalizedName: "feature-a",
      normalizedTitle: "feature-a",
      normalizedBranch: "main",
    });
  });

  it("counts changes across staged, unstaged, and untracked sections", () => {
    expect(
      countWorkspaceGitChanges({
        staged: [{ path: "a.ts" }],
        unstaged: [{ path: "b.ts" }, { path: "c.ts" }],
        untracked: [{ path: "d.ts" }],
      }),
    ).toBe(4);
  });
});
