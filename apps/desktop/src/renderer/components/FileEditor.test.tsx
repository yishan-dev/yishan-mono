// @vitest-environment jsdom

import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppTheme } from "../theme";
import { FileEditor } from "./FileEditor";

const mockEditorState: {
  editorValue: string;
  editorFocus: () => void;
  addCommandCalls: Array<{ keybinding: number; handler: () => void }>;
  contentChangeListener: null | (() => void);
  disposeCount: number;
  createCount: number;
  createOptions: unknown;
  lastModelLanguage: string | undefined;
  lastModelUri: unknown;
} = {
  editorValue: "",
  editorFocus: vi.fn(),
  addCommandCalls: [],
  contentChangeListener: null,
  disposeCount: 0,
  createCount: 0,
  createOptions: null,
  lastModelLanguage: undefined,
  lastModelUri: null,
};

vi.mock("../helpers/monacoSetup", () => ({
  YISHAN_THEME_DARK: "yishan-dark",
  YISHAN_THEME_LIGHT: "yishan-light",
  ensureEditorThemes: vi.fn(),
  monaco: {
    KeyMod: { CtrlCmd: 2048 },
    KeyCode: { KeyS: 49 },
    Uri: {
      file: (path: string) => ({ scheme: "file", path }),
    },
    editor: {
      create: (container: HTMLElement, options: Record<string, unknown>) => {
        mockEditorState.createCount += 1;
        mockEditorState.createOptions = options;

        return {
          getValue: () => mockEditorState.editorValue,
          setValue: (value: string) => {
            mockEditorState.editorValue = value;
          },
          focus: () => mockEditorState.editorFocus(),
          addCommand: (keybinding: number, handler: () => void) => {
            mockEditorState.addCommandCalls.push({ keybinding, handler });
          },
          onDidChangeModelContent: (listener: () => void) => {
            mockEditorState.contentChangeListener = listener;
            return { dispose: vi.fn() };
          },
          dispose: () => {
            mockEditorState.disposeCount += 1;
          },
        };
      },
      createModel: (value: string, language?: string, uri?: unknown) => {
        mockEditorState.editorValue = value;
        mockEditorState.lastModelLanguage = language;
        mockEditorState.lastModelUri = uri;
        return {
          setValue: (v: string) => {
            mockEditorState.editorValue = v;
          },
          dispose: vi.fn(),
        };
      },
      getModel: () => null,
      setModelLanguage: vi.fn(),
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
    },
  },
}));

vi.mock("../helpers/editorLanguage", () => ({
  getLanguageId: (path: string) => {
    if (path.endsWith(".unknown")) return null;
    if (path.endsWith(".ts")) return "typescript";
    if (path.endsWith(".py")) return "python";
    return "plaintext";
  },
}));

vi.mock("./fileTreeIcons", () => ({
  getFileTreeIcon: (path: string) => `/icons/${path.split("/").pop()}.svg`,
}));

afterEach(() => {
  cleanup();
  mockEditorState.editorValue = "";
  mockEditorState.editorFocus = vi.fn();
  mockEditorState.addCommandCalls = [];
  mockEditorState.contentChangeListener = null;
  mockEditorState.disposeCount = 0;
  mockEditorState.createCount = 0;
  mockEditorState.createOptions = null;
  mockEditorState.lastModelLanguage = undefined;
  mockEditorState.lastModelUri = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FileEditor", () => {
  it("creates a Monaco editor on mount", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    expect(mockEditorState.createCount).toBe(1);
  });

  it("triggers save callback on Cmd+S binding", () => {
    const onSave = vi.fn();

    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" onSave={onSave} />
      </ThemeProvider>,
    );

    // Simulate the user editing the document after mount.
    mockEditorState.editorValue = "saved text";

    const saveCommand = mockEditorState.addCommandCalls.find((c) => c.keybinding === (2048 | 49));
    expect(saveCommand).toBeTruthy();
    saveCommand?.handler();

    expect(onSave).toHaveBeenCalledWith("saved text");
  });

  it("emits changed content through onContentChange", () => {
    const onContentChange = vi.fn();

    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" onContentChange={onContentChange} />
      </ThemeProvider>,
    );

    // Simulate the user editing the document after mount.
    mockEditorState.editorValue = "next text";

    expect(mockEditorState.contentChangeListener).toBeTruthy();
    mockEditorState.contentChangeListener?.();

    expect(onContentChange).toHaveBeenCalledWith("next text");
  });

  it("creates model with the correct language for supported files", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    expect(mockEditorState.lastModelLanguage).toBe("typescript");
  });

  it("creates model without language for unsupported files", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="data/file.unknown" content="initial" />
      </ThemeProvider>,
    );

    expect(mockEditorState.lastModelLanguage).toBeUndefined();
  });

  it("creates model with file:// URI matching the path", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="/Users/dev/project/main.ts" content="initial" />
      </ThemeProvider>,
    );

    expect(mockEditorState.lastModelUri).toEqual({ scheme: "file", path: "/Users/dev/project/main.ts" });
  });

  it("uses dark theme when MUI theme is dark", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    expect((mockEditorState.createOptions as { theme?: string })?.theme).toBe("yishan-dark");
  });

  it("uses light theme when MUI theme is light", () => {
    render(
      <ThemeProvider theme={createAppTheme("light")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    expect((mockEditorState.createOptions as { theme?: string })?.theme).toBe("yishan-light");
  });

  it("focuses the editor when requested", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { rerender } = render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" focusRequestKey={0} />
      </ThemeProvider>,
    );

    expect(mockEditorState.editorFocus).not.toHaveBeenCalled();

    rerender(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" focusRequestKey={1} />
      </ThemeProvider>,
    );

    expect(mockEditorState.editorFocus).toHaveBeenCalledTimes(1);
  });

  it("recreates editor when path changes", () => {
    const { rerender } = render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    expect(mockEditorState.createCount).toBe(1);

    rerender(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/b.py" content="print('hi')" />
      </ThemeProvider>,
    );

    expect(mockEditorState.createCount).toBe(2);
    expect(mockEditorState.disposeCount).toBe(1);
  });

  it("displays the file path in the header", () => {
    const { getByText } = render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/components/App.tsx" content="initial" />
      </ThemeProvider>,
    );

    expect(getByText("src/components/App.tsx")).toBeTruthy();
  });

  it("displays the file icon before the path in the header", () => {
    const { container } = render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/components/App.tsx" content="initial" />
      </ThemeProvider>,
    );

    const icon = container.querySelector('img[src="/icons/App.tsx.svg"]');
    expect(icon).toBeTruthy();
  });
});
