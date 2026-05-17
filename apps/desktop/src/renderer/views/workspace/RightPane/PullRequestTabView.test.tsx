// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PullRequestTabView } from "./PullRequestTabView";

const mocked = vi.hoisted(() => ({
  openLink: vi.fn(),
  state: {
    pullRequest: undefined as any,
    isLoading: false,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../commands/appCommands", () => ({
  openLink: (options: { url: string }) => mocked.openLink(options),
}));

vi.mock("./useWorkspacePullRequestState", () => ({
  useWorkspacePullRequestState: () => mocked.state,
}));

afterEach(() => {
  mocked.openLink.mockReset();
  mocked.state.pullRequest = undefined;
  mocked.state.isLoading = false;
});

describe("PullRequestTabView", () => {
  it("renders empty state when no PR exists", () => {
    render(<PullRequestTabView />);

    expect(screen.getByText("workspace.pr.empty")).toBeTruthy();
  });

  it("renders PR checks and deployments", () => {
    mocked.state.pullRequest = {
      number: 42,
      title: "Add PR tab",
      status: "review",
      branch: "feature/pr-tab",
      baseBranch: "main",
      url: "https://github.com/acme/repo/pull/42",
      checks: [
        {
          name: "CI",
          workflow: "build",
          state: "SUCCESS",
          description: "All good",
          url: "https://ci.example.com/run/42",
        },
      ],
      deployments: [
        {
          id: 7,
          environment: "production",
          state: "success",
          description: "Live",
          environmentUrl: "https://prod.example.com",
        },
      ],
    };

    render(<PullRequestTabView />);

    expect(screen.getByText("#42 Add PR tab")).toBeTruthy();
    expect(screen.getByText("build / CI")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "workspace.pr.viewDetails" }));
    expect(mocked.openLink).toHaveBeenCalledWith({ url: "https://github.com/acme/repo/pull/42" });
  });
});
