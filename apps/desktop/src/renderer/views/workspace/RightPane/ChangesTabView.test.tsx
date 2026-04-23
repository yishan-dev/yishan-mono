// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangesTabView } from "./ChangesTabView";

const mocks = vi.hoisted(() => ({
  listGitChanges: vi.fn(),
  readBranchComparisonDiff: vi.fn(),
  readCommitDiff: vi.fn(),
  readDiff: vi.fn(),
  listGitCommitsToTarget: vi.fn(),
  trackGitChanges: vi.fn(),
  revertGitChanges: vi.fn(),
  unstageGitChanges: vi.fn(),
  subscribeWorkspaceGitChanged: vi.fn((_listener: (payload: { workspaceWorktreePath: string }) => void) => () => {}),
  openTab: vi.fn(),
}));

vi.mock("../../../commands/gitCommands", () => ({
  listGitChanges: (...args: unknown[]) => mocks.listGitChanges(...args),
  readBranchComparisonDiff: (...args: unknown[]) => mocks.readBranchComparisonDiff(...args),
  readDiff: (...args: unknown[]) => mocks.readDiff(...args),
  readCommitDiff: (...args: unknown[]) => mocks.readCommitDiff(...args),
  listGitCommitsToTarget: (...args: unknown[]) => mocks.listGitCommitsToTarget(...args),
  getGitAuthorName: vi.fn(),
  trackGitChanges: (...args: unknown[]) => mocks.trackGitChanges(...args),
  revertGitChanges: (...args: unknown[]) => mocks.revertGitChanges(...args),
  unstageGitChanges: (...args: unknown[]) => mocks.unstageGitChanges(...args),
  subscribeWorkspaceGitChanged: (listener: (payload: { workspaceWorktreePath: string }) => void) =>
    mocks.subscribeWorkspaceGitChanged(listener),
}));

vi.mock("../../../store/workspaceStore", () => ({
  workspaceStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      selectedWorkspaceId: "workspace-1",
      workspaces: [
        {
          id: "workspace-1",
          worktreePath: "/tmp/repo",
          sourceBranch: "main",
        },
      ],
      openTab: mocks.openTab,
    }),
}));

vi.mock("../../../hooks/useCommands", () => ({
  useCommands: () => ({
    openTab: mocks.openTab,
    listGitChanges: mocks.listGitChanges,
    readBranchComparisonDiff: mocks.readBranchComparisonDiff,
    readCommitDiff: mocks.readCommitDiff,
    readDiff: mocks.readDiff,
    listGitCommitsToTarget: mocks.listGitCommitsToTarget,
    trackGitChanges: mocks.trackGitChanges,
    revertGitChanges: mocks.revertGitChanges,
    unstageGitChanges: mocks.unstageGitChanges,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "files.git.unstaged": "Unstaged",
        "files.git.staged": "Staged",
        "files.git.untracked": "Untracked",
        "files.git.changeScope": "Change scope",
      };

      return translations[key] ?? key;
    },
  }),
}));

describe("ChangesTabView", () => {
  beforeEach(() => {
    mocks.listGitChanges.mockResolvedValue({ unstaged: [], staged: [], untracked: [] });
    mocks.listGitCommitsToTarget.mockResolvedValue({
      currentBranch: "feature/work",
      targetBranch: "main",
      allChangedFiles: [],
      commits: [],
    });
    mocks.trackGitChanges.mockResolvedValue({ ok: true });
    mocks.revertGitChanges.mockResolvedValue({ ok: true });
    mocks.unstageGitChanges.mockResolvedValue({ ok: true });
    mocks.readDiff.mockResolvedValue({ oldContent: "", newContent: "" });
    mocks.readBranchComparisonDiff.mockResolvedValue({ oldContent: "", newContent: "" });
    mocks.readCommitDiff.mockResolvedValue({ oldContent: "", newContent: "" });
    mocks.subscribeWorkspaceGitChanged.mockReset();
    mocks.subscribeWorkspaceGitChanged.mockImplementation(() => () => {});
    mocks.openTab.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a progress bar while workspace changes are loading", async () => {
    let resolveListGitChanges: ((value: { unstaged: []; staged: []; untracked: [] }) => void) | undefined;
    mocks.listGitChanges.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveListGitChanges = resolve;
        }),
    );

    render(<ChangesTabView />);

    expect(await screen.findByTestId("changes-tab-loading-progress")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Change scope" })).toBeNull();

    resolveListGitChanges?.({ unstaged: [], staged: [], untracked: [] });

    await waitFor(() => {
      expect(screen.queryByTestId("changes-tab-loading-progress")).toBeNull();
    });
  });

  it("hides workspace switch progress after git changes load even if commits are still loading", async () => {
    let resolveCommits:
      | ((value: { currentBranch: string; targetBranch: string; allChangedFiles: string[]; commits: [] }) => void)
      | undefined;
    mocks.listGitCommitsToTarget.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommits = resolve;
        }),
    );

    render(<ChangesTabView />);

    expect(await screen.findByTestId("changes-tab-loading-progress")).toBeTruthy();

    await waitFor(() => {
      expect(mocks.listGitChanges).toHaveBeenCalled();
      expect(screen.queryByTestId("changes-tab-loading-progress")).toBeNull();
    });

    resolveCommits?.({
      currentBranch: "feature/work",
      targetBranch: "main",
      allChangedFiles: [],
      commits: [],
    });
  });

  it("loads commit comparison using workspace source branch", async () => {
    render(<ChangesTabView />);

    await waitFor(() => {
      expect(mocks.listGitCommitsToTarget.mock.calls.length).toBeGreaterThan(0);
      expect(mocks.listGitCommitsToTarget).toHaveBeenCalledWith({
        workspaceWorktreePath: "/tmp/repo",
        targetBranch: "main",
      });
    });
    expect(screen.queryByRole("combobox", { name: "Target branch" })).toBeNull();
  });

  it("opens diff tab when selecting one commit changed file", async () => {
    mocks.listGitCommitsToTarget.mockResolvedValue({
      currentBranch: "feature/work",
      targetBranch: "main",
      allChangedFiles: ["src/a.ts"],
      commits: [
        {
          hash: "abc123456",
          shortHash: "abc1234",
          authorName: "Pat",
          committedAt: "2026-03-23T08:00:00+00:00",
          subject: "feat: improve flow",
          changedFiles: ["src/a.ts"],
        },
      ],
    });
    mocks.readCommitDiff.mockResolvedValue({ oldContent: "old", newContent: "new" });

    render(<ChangesTabView />);

    const scopeInput = await screen.findByRole("combobox", { name: "Change scope" });
    fireEvent.change(scopeInput, { target: { value: "abc1234" } });
    fireEvent.mouseDown(scopeInput);
    fireEvent.click(await screen.findByRole("option", { name: "abc1234 feat: improve flow" }));
    expect(screen.getByText("Changes in abc1234")).toBeTruthy();
    fireEvent.click(screen.getByText("a.ts"));

    await waitFor(() => {
      expect(mocks.readCommitDiff).toHaveBeenCalledWith({
        workspaceWorktreePath: "/tmp/repo",
        commitHash: "abc123456",
        relativePath: "src/a.ts",
      });
      expect(mocks.openTab).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        kind: "diff",
        path: "src/a.ts",
        changeKind: "modified",
        additions: 0,
        deletions: 0,
        oldContent: "old",
        newContent: "new",
      });
    });
  });

  it("shows aggregate branch-diff files when selecting all commit changes", async () => {
    mocks.listGitCommitsToTarget.mockResolvedValue({
      currentBranch: "feature/work",
      targetBranch: "main",
      allChangedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
      commits: [
        {
          hash: "abc123456",
          shortHash: "abc1234",
          authorName: "Pat",
          committedAt: "2026-03-23T08:00:00+00:00",
          subject: "feat: part one",
          changedFiles: ["src/a.ts", "src/b.ts"],
        },
        {
          hash: "def987654",
          shortHash: "def9876",
          authorName: "Pat",
          committedAt: "2026-03-24T08:00:00+00:00",
          subject: "feat: part two",
          changedFiles: ["src/b.ts", "src/c.ts"],
        },
      ],
    });

    render(<ChangesTabView />);

    const scopeInput = await screen.findByRole("combobox", { name: "Change scope" });
    fireEvent.change(scopeInput, { target: { value: "All changes" } });
    fireEvent.mouseDown(scopeInput);
    fireEvent.click(await screen.findByRole("option", { name: "All changes (3)" }));

    expect(screen.getByText("Changes in all")).toBeTruthy();
    expect(screen.getByText("a.ts")).toBeTruthy();
    expect(screen.getByText("b.ts")).toBeTruthy();
    expect(screen.getByText("c.ts")).toBeTruthy();

    mocks.readBranchComparisonDiff.mockResolvedValue({ oldContent: "old", newContent: "new" });
    fireEvent.click(screen.getByText("a.ts"));

    await waitFor(() => {
      expect(mocks.readBranchComparisonDiff).toHaveBeenCalledWith({
        workspaceWorktreePath: "/tmp/repo",
        targetBranch: "main",
        relativePath: "src/a.ts",
      });
      expect(mocks.openTab).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        kind: "diff",
        path: "src/a.ts",
        changeKind: "modified",
        additions: 0,
        deletions: 0,
        oldContent: "old",
        newContent: "new",
      });
    });
  });

  it("removes commit editor controls from the active changes pane", async () => {
    render(<ChangesTabView />);

    expect(await screen.findByRole("combobox", { name: "Change scope" })).toBeTruthy();
    expect(screen.queryByLabelText("Enter commit message")).toBeNull();
    expect(screen.queryByRole("button", { name: "Commit" })).toBeNull();
  });

  it("normalizes and deduplicates aggregate changed file paths", async () => {
    mocks.listGitCommitsToTarget.mockResolvedValue({
      currentBranch: "feature/work",
      targetBranch: "main",
      allChangedFiles: [" src\\a.ts ", "src/a.ts", "src/b.ts", ""],
      commits: [],
    });
    mocks.readBranchComparisonDiff.mockResolvedValue({ oldContent: "old", newContent: "new" });

    render(<ChangesTabView />);

    const scopeInput = await screen.findByRole("combobox", { name: "Change scope" });
    fireEvent.change(scopeInput, { target: { value: "All changes" } });
    fireEvent.mouseDown(scopeInput);
    fireEvent.click(await screen.findByRole("option", { name: "All changes (2)" }));

    expect(screen.getAllByText("a.ts").length).toBe(1);
    expect(screen.getAllByText("b.ts").length).toBe(1);

    fireEvent.click(screen.getByText("a.ts"));

    await waitFor(() => {
      expect(mocks.readBranchComparisonDiff).toHaveBeenCalledWith({
        workspaceWorktreePath: "/tmp/repo",
        targetBranch: "main",
        relativePath: "src/a.ts",
      });
    });
  });

  it("ignores untracked directory entries with trailing slash", async () => {
    mocks.listGitChanges.mockResolvedValue({
      unstaged: [],
      staged: [],
      untracked: [{ path: ".openwork/", kind: "added", additions: 0, deletions: 0 }],
    });

    render(<ChangesTabView />);

    await screen.findByTestId("changes-list-root");
    expect(screen.queryByText(".openwork")).toBeNull();
    expect(screen.queryByTestId("changes-file-untracked-.openwork/")).toBeNull();
    expect(screen.queryByTestId("changes-section-untracked")).toBeNull();
  });
});
