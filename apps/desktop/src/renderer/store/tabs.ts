import type { DiffFileChangeKind, OpenWorkspaceTabInput, WorkspaceTab, WorkspaceTabDataByKind } from "./types";

export function getFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() ?? path;
}

function clampLineCount(value: number): number {
  return Math.max(1, Math.min(value, 12));
}

export function resolveSelectedTabIdForWorkspace(input: {
  workspaceId: string;
  tabs: WorkspaceTab[];
  selectedTabIdByWorkspaceId: Record<string, string>;
}): string {
  const workspaceTabs = input.tabs.filter((tab) => tab.workspaceId === input.workspaceId);
  const preferredTabId = input.selectedTabIdByWorkspaceId[input.workspaceId];
  if (preferredTabId && workspaceTabs.some((tab) => tab.id === preferredTabId)) {
    return preferredTabId;
  }
  return workspaceTabs[0]?.id ?? "";
}

function createDiffContent(input: {
  path: string;
  kind: DiffFileChangeKind;
  additions: number;
  deletions: number;
}): { oldContent: string; newContent: string } {
  const fileName = getFileName(input.path);
  const normalizedAdditions = clampLineCount(input.additions);
  const normalizedDeletions = clampLineCount(input.deletions);

  if (input.kind === "added") {
    const addedLines = Array.from(
      { length: normalizedAdditions },
      (_, index) => `const addedLine${index + 1} = "${fileName} line ${index + 1}";`,
    );
    return {
      oldContent: "",
      newContent: [`// ${input.path}`, ...addedLines].join("\n"),
    };
  }

  if (input.kind === "deleted") {
    const deletedLines = Array.from(
      { length: normalizedDeletions },
      (_, index) => `const removedLine${index + 1} = "${fileName} line ${index + 1}";`,
    );
    return {
      oldContent: [`// ${input.path}`, ...deletedLines].join("\n"),
      newContent: "",
    };
  }

  const removedLines = Array.from(
    { length: normalizedDeletions },
    (_, index) => `const beforeLine${index + 1} = "${fileName} old ${index + 1}";`,
  );
  const addedLines = Array.from(
    { length: normalizedAdditions },
    (_, index) => `const afterLine${index + 1} = "${fileName} new ${index + 1}";`,
  );

  return {
    oldContent: [`// ${input.path}`, ...removedLines].join("\n"),
    newContent: [`// ${input.path}`, ...addedLines].join("\n"),
  };
}

function createFileContent(path: string): string {
  const fileName = getFileName(path);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "ts" || extension === "tsx") {
    return [
      `// ${path}`,
      "export function example() {",
      `  return \"Open file: ${fileName}\";`,
      "}",
      "",
      "console.log(example());",
    ].join("\n");
  }

  if (extension === "json") {
    return ["{", `  \"path\": \"${path}\",`, '  "status": "mock-content"', "}"].join("\n");
  }

  if (extension === "md") {
    return [`# ${fileName}`, "", `Opened from ${path}`, "", "This is mock file content rendered in Monaco Editor."].join(
      "\n",
    );
  }

  return [`Opened: ${path}`, "", "This tab is backed by a file tab in the workspace store."].join("\n");
}

export function buildTabDataByInput<T extends OpenWorkspaceTabInput>(input: T): WorkspaceTabDataByKind[T["kind"]] {
  if (input.kind === "diff") {
    if (typeof input.oldContent === "string" && typeof input.newContent === "string") {
      return {
        path: input.path,
        oldContent: input.oldContent,
        newContent: input.newContent,
        source: input.diffSource,
        isTemporary: Boolean(input.temporary),
      } as WorkspaceTabDataByKind[T["kind"]];
    }

    const { oldContent, newContent } = createDiffContent({
      path: input.path,
      kind: input.changeKind,
      additions: input.additions,
      deletions: input.deletions,
    });
    return {
      path: input.path,
      oldContent,
      newContent,
      source: input.diffSource,
      isTemporary: Boolean(input.temporary),
    } as WorkspaceTabDataByKind[T["kind"]];
  }

  if (input.kind === "file") {
    const fileContent = input.content ?? createFileContent(input.path);
    return {
      path: input.path,
      content: fileContent,
      savedContent: fileContent,
      isDirty: false,
      isTemporary: Boolean(input.temporary),
      ...(input.isUnsupported ? { isUnsupported: true } : {}),
      ...(input.unsupportedReason ? { unsupportedReason: input.unsupportedReason } : {}),
      isDeleted: false,
    } as WorkspaceTabDataByKind[T["kind"]];
  }

  if (input.kind === "image") {
    return {
      path: input.path,
      dataUrl: input.dataUrl,
      isTemporary: Boolean(input.temporary),
    } as WorkspaceTabDataByKind[T["kind"]];
  }

  return {
    title: input.title?.trim() || "Terminal",
    launchCommand: input.launchCommand?.trim() || undefined,
    agentKind: input.agentKind,
  } as WorkspaceTabDataByKind[T["kind"]];
}
