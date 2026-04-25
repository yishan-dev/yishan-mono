// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const mocks = vi.hoisted(() => ({
  useShortcuts: vi.fn(),
}));

vi.mock("../../hooks/useShortcuts", () => ({
  useShortcuts: mocks.useShortcuts,
}));

describe("AppShell", () => {
  it("renders outlet content", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>workspace-route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("workspace-route")).toBeTruthy();
  });

  it("initializes shortcuts hook", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>workspace-route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(mocks.useShortcuts).toHaveBeenCalled();
  });
});
