// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileTree } from "./FileTree";

describe("FileTree", () => {
  it("renders file labels with disabled text selection", () => {
    render(<FileTree files={["src/a.ts"]} />);

    const fileLabel = screen.getByText("a.ts") as HTMLElement;
    const directoryLabel = screen.getByText("src") as HTMLElement;

    expect(fileLabel.style.userSelect).toBe("none");
    expect(directoryLabel.style.userSelect).toBe("none");
  });
});
