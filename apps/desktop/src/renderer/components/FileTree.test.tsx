// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileTree } from "./FileTree";

const getFileTreeIconMock = vi.fn<(path: string, isFolder: boolean, isExpanded?: boolean) => string>(
  () => "mock-icon.svg",
);

vi.mock("./fileTreeIcons", () => ({
  getFileTreeIcon: (path: string, isFolder: boolean, isExpanded?: boolean) =>
    getFileTreeIconMock(path, isFolder, isExpanded),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "files.actions.createFile": "Create File",
          "files.actions.createFolder": "Create Folder",
          "files.actions.refresh": "Refresh",
          "files.search.inputPlaceholder": "Search files",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  getFileTreeIconMock.mockClear();
});

describe("FileTree", () => {
  it("creates file when one create-entry request is provided", async () => {
    const onCreateEntry = vi.fn().mockResolvedValue(undefined);

    const rendered = render(<FileTree files={["src/a.ts"]} onCreateEntry={onCreateEntry} />);

    rendered.rerender(
      <FileTree
        files={["src/a.ts"]}
        onCreateEntry={onCreateEntry}
        createEntryRequest={{ kind: "file", requestId: 1 }}
      />,
    );

    const createInput = await screen.findByRole("textbox");
    fireEvent.change(createInput, { target: { value: "requested.ts" } });
    fireEvent.keyDown(createInput, { key: "Enter" });

    await waitFor(() => {
      expect(onCreateEntry).toHaveBeenCalledWith({ path: "requested.ts", isDirectory: false });
    });
  });

  it("creates folder when one create-entry request is provided", async () => {
    const onCreateEntry = vi.fn().mockResolvedValue(undefined);

    const rendered = render(<FileTree files={["src/a.ts"]} onCreateEntry={onCreateEntry} />);

    rendered.rerender(
      <FileTree
        files={["src/a.ts"]}
        onCreateEntry={onCreateEntry}
        createEntryRequest={{ kind: "folder", requestId: 2 }}
      />,
    );

    const createInput = await screen.findByRole("textbox");
    fireEvent.change(createInput, { target: { value: "requested-folder" } });
    fireEvent.keyDown(createInput, { key: "Enter" });

    await waitFor(() => {
      expect(onCreateEntry).toHaveBeenCalledWith({ path: "requested-folder", isDirectory: true });
    });
  });

  it("supports keyboard copy and paste shortcuts for selected entries", async () => {
    const onCopyEntry = vi.fn().mockResolvedValue(undefined);
    const onPasteEntries = vi.fn().mockResolvedValue(undefined);

    render(<FileTree files={["src/a.ts"]} onCopyEntry={onCopyEntry} onPasteEntries={onPasteEntries} canPasteEntries />);

    fireEvent.click(screen.getByText("a.ts"));
    fireEvent.keyDown(screen.getByTestId("repo-file-tree-area"), { key: "c", metaKey: true });
    fireEvent.keyDown(screen.getByTestId("repo-file-tree-area"), { key: "v", metaKey: true });

    await waitFor(() => {
      expect(onCopyEntry).toHaveBeenCalledWith("src/a.ts");
      expect(onPasteEntries).toHaveBeenCalledWith("src");
    });
  });

  it("applies external selection request and focuses tree area for keyboard copy", async () => {
    const onCopyEntry = vi.fn().mockResolvedValue(undefined);

    render(
      <FileTree
        files={["src/a.ts", "src/b.ts"]}
        onCopyEntry={onCopyEntry}
        selectionRequest={{ path: "src/b.ts", requestId: 1, focus: true }}
      />,
    );

    const treeArea = screen.getByTestId("repo-file-tree-area");
    expect(document.activeElement).toBe(treeArea);

    fireEvent.keyDown(treeArea, { key: "c", metaKey: true });

    await waitFor(() => {
      expect(onCopyEntry).toHaveBeenCalledWith("src/b.ts");
    });
  });

  it("selects first visible file on focus so arrow navigation can start immediately", async () => {
    const onCopyEntry = vi.fn().mockResolvedValue(undefined);

    render(<FileTree files={["src/a.ts"]} onCopyEntry={onCopyEntry} />);

    const treeArea = screen.getByTestId("repo-file-tree-area");
    treeArea.focus();

    await waitFor(() => {
      expect(screen.getByRole("treeitem", { name: "a.ts" }).getAttribute("aria-checked")).toBe("true");
    });

    fireEvent.keyDown(treeArea, { key: "c", metaKey: true });

    await waitFor(() => {
      expect(onCopyEntry).toHaveBeenCalledWith("src/a.ts");
    });
  });

  it("imports dropped external entries into directory targets", async () => {
    const onDropExternalEntries = vi.fn().mockResolvedValue(undefined);
    const droppedPath = "/Users/test/Desktop/report.md";

    render(<FileTree files={["src/a.ts"]} onDropExternalEntries={onDropExternalEntries} />);

    const dataTransfer = {
      types: ["Files"],
      files: [{ path: droppedPath }],
      items: [{ getAsFile: () => ({ path: droppedPath }) }],
      dropEffect: "",
    };

    fireEvent.dragOver(screen.getByText("src"), { dataTransfer });
    fireEvent.drop(screen.getByText("src"), { dataTransfer });

    await waitFor(() => {
      expect(onDropExternalEntries).toHaveBeenCalledWith([droppedPath], "src");
    });
  });

  it("emits one context menu event and exposes create and rename actions", async () => {
    const onItemContextMenu = vi.fn();

    render(
      <FileTree
        files={["src/a.ts"]}
        onRenameEntry={vi.fn()}
        onItemContextMenu={onItemContextMenu}
        onCreateEntry={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByText("a.ts"), { clientX: 30, clientY: 20 });

    expect(onItemContextMenu).toHaveBeenCalledTimes(1);
    const menuRequest = onItemContextMenu.mock.calls[0]?.[0];
    expect(menuRequest).toMatchObject({
      mouseX: 30,
      mouseY: 20,
      basePath: "src",
      targetPath: "src/a.ts",
      targetIsDirectory: false,
    });

    menuRequest.startRename();
    expect(await screen.findByDisplayValue("a.ts")).toBeTruthy();
  });

  it("marks ignored files and folders for greyed display", () => {
    render(<FileTree files={["dist/", "bundle.js", "src/index.ts"]} ignoredPaths={["dist/", "bundle.js"]} />);

    expect(screen.getByText("dist").getAttribute("data-ignored")).toBe("true");
    expect(screen.getByText("bundle.js").getAttribute("data-ignored")).toBe("true");
    expect(screen.getByText("index.ts").getAttribute("data-ignored")).toBe("false");
  });

  it("keeps ignored directories collapsed by default", () => {
    render(
      <FileTree
        files={["node_modules/", "node_modules/pkg/index.js", "src/index.ts"]}
        ignoredPaths={["node_modules/"]}
      />,
    );

    expect(screen.getByText("node_modules")).toBeTruthy();
    expect(screen.queryByText("pkg")).toBeNull();
    expect(screen.queryByText("index.js")).toBeNull();
    expect(screen.getByText("index.ts")).toBeTruthy();
  });

  it("keeps preloaded explicit directories collapsed by default", () => {
    render(<FileTree files={["src/", "src/a.ts", "src/utils/", "src/utils/format.ts"]} />);

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.queryByText("a.ts")).toBeNull();
    expect(screen.queryByText("utils")).toBeNull();
    expect(screen.queryByText("format.ts")).toBeNull();
  });

  it("resets default expansion when rerendered with a different repo tree", () => {
    const rendered = render(<FileTree files={["src/a.ts"]} />);

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("a.ts")).toBeTruthy();

    rendered.rerender(<FileTree files={["slides/intro.md"]} />);

    expect(screen.getByText("slides")).toBeTruthy();
    expect(screen.getByText("intro.md")).toBeTruthy();
    expect(screen.queryByText("src")).toBeNull();
  });
});
