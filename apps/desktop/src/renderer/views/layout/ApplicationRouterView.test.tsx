// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationRouterView, NotFoundRouteView } from "./ApplicationRouterView";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../WorkspaceView", async () => {
  const reactModule = await import("react");

  return {
    WorkspaceView: () => {
      const [value, setValue] = reactModule.useState("");

      return (
        <label htmlFor="workspace-input">
          workspace-view
          <input
            id="workspace-input"
            data-testid="workspace-input"
            value={value}
            onChange={(event) => {
              setValue(event.currentTarget.value);
            }}
          />
        </label>
      );
    },
  };
});

/** Exposes lightweight route controls for testing route transitions within one router instance. */
function RouterControls() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate("/")}>
        to-repos
      </button>
      <button type="button" onClick={() => navigate("/settings")}>
        to-settings
      </button>
      <button type="button" onClick={() => navigate("/keybindings")}>
        to-keybindings
      </button>
      <button type="button" onClick={() => navigate("/unknown")}>
        to-unknown
      </button>
    </>
  );
}

/** Renders the application router inside one memory router for route-state tests. */
function renderApplicationRouter(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RouterControls />
      <Routes>
        <Route path="/" element={<ApplicationRouterView />}>
          <Route index element={null} />
          <Route path="settings" element={<div data-testid="settings-overlay">settings-overlay</div>} />
          <Route path="keybindings" element={<div data-testid="keybindings-overlay">keybindings-overlay</div>} />
        </Route>
        <Route path="*" element={<NotFoundRouteView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ApplicationRouterView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders workspace view on / route", () => {
    renderApplicationRouter("/");

    expect(screen.getByTestId("workspace-input")).toBeTruthy();
    expect(screen.queryByTestId("settings-overlay")).toBeNull();
    expect(screen.queryByTestId("keybindings-overlay")).toBeNull();
  });

  it("keeps workspace mounted while showing settings overlay", () => {
    renderApplicationRouter("/");

    const input = screen.getByTestId("workspace-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sticky-state" } });
    fireEvent.click(screen.getByText("to-settings"));

    expect(screen.getByTestId("settings-overlay")).toBeTruthy();
    expect((screen.getByTestId("workspace-input") as HTMLInputElement).value).toBe("sticky-state");

    fireEvent.click(screen.getByText("to-repos"));

    expect(screen.queryByTestId("settings-overlay")).toBeNull();
    expect((screen.getByTestId("workspace-input") as HTMLInputElement).value).toBe("sticky-state");
  });

  it("shows keybindings as overlay while preserving workspace state", () => {
    renderApplicationRouter("/");

    const input = screen.getByTestId("workspace-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "workspace-value" } });
    fireEvent.click(screen.getByText("to-keybindings"));

    expect(screen.getByTestId("keybindings-overlay")).toBeTruthy();
    expect((screen.getByTestId("workspace-input") as HTMLInputElement).value).toBe("workspace-value");
  });

  it("shows not-found state for unknown routes and allows returning", () => {
    renderApplicationRouter("/unknown");

    expect(screen.getByText("routing.notFound.title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "routing.notFound.backToWorkspace" }));

    expect(screen.getByTestId("workspace-input")).toBeTruthy();
    expect(screen.queryByText("routing.notFound.title")).toBeNull();
  });
});
