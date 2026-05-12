// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";

vi.mock("../fileTreeIcons", () => ({
  getFileTreeIcon: () => "mock-icon.svg",
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 28,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 28,
        size: 28,
      })),
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  }),
}));

describe("FileTree", () => {
  it("renders file labels with disabled text selection", () => {
    render(<FileTree files={["src/a.ts"]} />);

    const fileLabel = screen.getByText("a.ts") as HTMLElement;
    const directoryLabel = screen.getByText("src") as HTMLElement;

    expect(fileLabel.closest('[data-path="src/a.ts"]')).toBeTruthy();
    expect(directoryLabel.closest('[data-path="src"]')).toBeTruthy();
  });
});
