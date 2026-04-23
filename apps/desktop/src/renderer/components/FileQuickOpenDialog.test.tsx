// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FileQuickOpenDialog } from "./FileQuickOpenDialog";

vi.mock("./fileTreeIcons", () => ({
  getFileTreeIcon: () => "mock-icon.svg",
}));

vi.mock("react-icons/bi", () => ({
  BiSearch: () => <svg data-testid="file-search-icon" />,
}));

describe("FileQuickOpenDialog", () => {
  it("uses a compact search input", async () => {
    render(
      <FileQuickOpenDialog
        open
        query=""
        selectedResultIndex={0}
        results={[]}
        placeholder="Search files..."
        emptyText="No matching files."
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onInputKeyDown={vi.fn()}
        onSelectResultIndex={vi.fn()}
        onOpenResult={vi.fn()}
      />,
    );

    const input = await screen.findByRole("textbox", { name: "Search files..." });
    expect(input.getAttribute("style")).toContain("font-size: 14px");
    expect(input.getAttribute("style")).toContain("padding: 8px 0px");
    expect(input.closest(".MuiFormControl-root")?.querySelector(".MuiInputBase-sizeSmall")).toBeTruthy();
    expect(screen.getByTestId("file-search-icon")).toBeTruthy();
    expect(screen.queryByText("Search files")).toBeNull();
  });

  it("hides the bordered results container when there are no items", async () => {
    render(
      <FileQuickOpenDialog
        open
        query="missing"
        selectedResultIndex={0}
        results={[]}
        placeholder="Search files..."
        emptyText="No matching files."
        onClose={vi.fn()}
        onQueryChange={vi.fn()}
        onInputKeyDown={vi.fn()}
        onSelectResultIndex={vi.fn()}
        onOpenResult={vi.fn()}
      />,
    );

    expect(await screen.findByText("No matching files.")).toBeTruthy();
    expect(screen.queryByTestId("file-quick-open-results")).toBeNull();
  });
});
