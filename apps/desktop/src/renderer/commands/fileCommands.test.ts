// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  createFile,
  createFolder,
  deleteEntry,
  importEntries,
  importFilePayloads,
  listFiles,
  openEntryInExternalApp,
  pasteEntries,
  readExternalClipboardSourcePaths,
  readFile,
  renameEntry,
  writeFile,
} from "./fileCommands";

const mocks = vi.hoisted(() => ({
  createFile: vi.fn(),
  createFolder: vi.fn(),
  deleteEntry: vi.fn(),
  importEntries: vi.fn(),
  importFilePayloads: vi.fn(),
  listFiles: vi.fn(),
  openEntryInExternalApp: vi.fn(),
  pasteEntries: vi.fn(),
  readExternalClipboardSourcePaths: vi.fn(),
  readFile: vi.fn(),
  renameEntry: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("../rpc/rpcTransport", () => ({
  getApiServiceClient: vi.fn(async () => ({
    file: {
      createFile: {
        mutate: mocks.createFile,
      },
      createFolder: {
        mutate: mocks.createFolder,
      },
      deleteEntry: {
        mutate: mocks.deleteEntry,
      },
      importEntries: {
        mutate: mocks.importEntries,
      },
      importFilePayloads: {
        mutate: mocks.importFilePayloads,
      },
      listFiles: {
        query: mocks.listFiles,
      },
      openEntryInExternalApp: {
        mutate: mocks.openEntryInExternalApp,
      },
      pasteEntries: {
        mutate: mocks.pasteEntries,
      },
      readExternalClipboardSourcePaths: {
        query: mocks.readExternalClipboardSourcePaths,
      },
      readFile: {
        query: mocks.readFile,
      },
      renameEntry: {
        mutate: mocks.renameEntry,
      },
      writeFile: {
        mutate: mocks.writeFile,
      },
    },
  })),
  getDesktopHostBridge: vi.fn(() => ({
    openEntryInExternalApp: mocks.openEntryInExternalApp,
    readExternalClipboardSourcePaths: mocks.readExternalClipboardSourcePaths,
  })),
}));

describe("fileCommands", () => {
  it("forwards file command requests to file service", async () => {
    await listFiles({ workspaceWorktreePath: "/tmp/repo", relativePath: "src", recursive: false });
    await readFile({ workspaceWorktreePath: "/tmp/repo", relativePath: "a.ts" });
    await writeFile({ workspaceWorktreePath: "/tmp/repo", relativePath: "a.ts", content: "x" });
    await createFile({ workspaceWorktreePath: "/tmp/repo", relativePath: "b.ts", content: "y" });
    await createFolder({ workspaceWorktreePath: "/tmp/repo", relativePath: "src" });
    await renameEntry({ workspaceWorktreePath: "/tmp/repo", fromRelativePath: "a.ts", toRelativePath: "c.ts" });
    await deleteEntry({ workspaceWorktreePath: "/tmp/repo", relativePath: "c.ts" });
    await openEntryInExternalApp({
      workspaceWorktreePath: "/tmp/repo",
      appId: "system-file-manager",
      relativePath: "src",
    });
    await openEntryInExternalApp({ workspaceWorktreePath: "/tmp/repo", appId: "cursor" });
    await readExternalClipboardSourcePaths();
    await pasteEntries({
      workspaceWorktreePath: "/tmp/repo",
      sourceRelativePaths: ["a.ts"],
      destinationRelativePath: "src",
      mode: "copy",
    });
    await importEntries({
      workspaceWorktreePath: "/tmp/repo",
      sourcePaths: ["/tmp/from.txt"],
      destinationRelativePath: "src",
    });
    await importFilePayloads({
      workspaceWorktreePath: "/tmp/repo",
      filePayloads: [{ relativePath: "x.txt", contentBase64: "eA==" }],
      destinationRelativePath: "src",
    });

    expect(mocks.listFiles).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      relativePath: "src",
      recursive: false,
    });
    expect(mocks.readFile).toHaveBeenCalledWith({ workspaceWorktreePath: "/tmp/repo", relativePath: "a.ts" });
    expect(mocks.writeFile).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      relativePath: "a.ts",
      content: "x",
    });
    expect(mocks.createFile).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      relativePath: "b.ts",
      content: "y",
    });
    expect(mocks.createFolder).toHaveBeenCalledWith({ workspaceWorktreePath: "/tmp/repo", relativePath: "src" });
    expect(mocks.renameEntry).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      fromRelativePath: "a.ts",
      toRelativePath: "c.ts",
    });
    expect(mocks.deleteEntry).toHaveBeenCalledWith({ workspaceWorktreePath: "/tmp/repo", relativePath: "c.ts" });
    expect(mocks.openEntryInExternalApp).toHaveBeenNthCalledWith(1, {
      workspaceWorktreePath: "/tmp/repo",
      appId: "system-file-manager",
      relativePath: "src",
    });
    expect(mocks.openEntryInExternalApp).toHaveBeenNthCalledWith(2, {
      workspaceWorktreePath: "/tmp/repo",
      appId: "cursor",
    });
    expect(mocks.readExternalClipboardSourcePaths).toHaveBeenCalledTimes(1);
    expect(mocks.pasteEntries).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      sourceRelativePaths: ["a.ts"],
      destinationRelativePath: "src",
      mode: "copy",
    });
    expect(mocks.importEntries).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      sourcePaths: ["/tmp/from.txt"],
      destinationRelativePath: "src",
    });
    expect(mocks.importFilePayloads).toHaveBeenCalledWith({
      workspaceWorktreePath: "/tmp/repo",
      filePayloads: [{ relativePath: "x.txt", contentBase64: "eA==" }],
      destinationRelativePath: "src",
    });
  });
});
