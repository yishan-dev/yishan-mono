// @vitest-environment jsdom

import { ThemeProvider } from "@mui/material/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppTheme } from "../theme";
import { FileEditor } from "./FileEditor";

const mockStateRef: {
  latestExtensions: unknown[];
  editorDocText: string;
  editorStateCreateCount: number;
  updateListener: null | ((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void);
  keymapRun: null | (() => boolean);
} = {
  latestExtensions: [],
  editorDocText: "",
  editorStateCreateCount: 0,
  updateListener: null,
  keymapRun: null,
};

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: (input: { extensions?: unknown[] }) => {
      mockStateRef.editorStateCreateCount += 1;
      mockStateRef.latestExtensions = input.extensions ?? [];
      for (const extension of mockStateRef.latestExtensions) {
        const record = extension as {
          __kind?: string;
          listener?: typeof mockStateRef.updateListener;
          bindings?: unknown[];
        };
        if (record.__kind === "updateListener" && typeof record.listener === "function") {
          mockStateRef.updateListener = record.listener;
        }

        if (record.__kind === "keymap") {
          const binding = (record.bindings ?? [])[0] as { run?: () => boolean } | undefined;
          if (binding?.run) {
            mockStateRef.keymapRun = binding.run;
          }
        }
      }
      return {
        doc: {
          toString: () => mockStateRef.editorDocText,
        },
      };
    },
  },
}));

vi.mock("@codemirror/lang-javascript", () => ({
  javascript: () => ({ __kind: "javascript" }),
}));

vi.mock("@codemirror/language", () => ({
  HighlightStyle: {
    define: (styles: unknown[]) => ({ __kind: "highlightStyle", styles }),
  },
  syntaxHighlighting: (style: unknown) => ({ __kind: "syntaxHighlighting", style }),
}));

vi.mock("@lezer/highlight", () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  );

  return {
    tags: new Proxy(passthrough, {
      get: (_target, property) => {
        if (
          property === "function" ||
          property === "constant" ||
          property === "standard" ||
          property === "special" ||
          property === "definition"
        ) {
          return (value: unknown) => value;
        }

        return String(property);
      },
    }),
  };
});

vi.mock("@codemirror/view", () => ({
  keymap: {
    of: (bindings: unknown[]) => ({ __kind: "keymap", bindings }),
  },
}));

vi.mock("codemirror", () => {
  class MockEditorView {
    static lineWrapping = { __kind: "lineWrapping" };

    static updateListener = {
      of: (listener: (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) => ({
        __kind: "updateListener",
        listener,
      }),
    };

    static theme() {
      return { __kind: "theme" };
    }

    state: { doc: { toString: () => string } };

    constructor(input: { state: { doc: { toString: () => string } } }) {
      this.state = input.state;
    }

    dispatch() {
      return undefined;
    }

    destroy() {
      return undefined;
    }
  }

  return {
    EditorView: MockEditorView,
    basicSetup: { __kind: "basicSetup" },
  };
});

afterEach(() => {
  cleanup();
  mockStateRef.latestExtensions = [];
  mockStateRef.editorDocText = "";
  mockStateRef.editorStateCreateCount = 0;
  mockStateRef.updateListener = null;
  mockStateRef.keymapRun = null;
  vi.clearAllMocks();
});

describe("FileEditor", () => {
  it("triggers save callback on Mod+S binding", () => {
    const onSave = vi.fn();
    mockStateRef.editorDocText = "saved text";

    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" onSave={onSave} />
      </ThemeProvider>,
    );

    expect(mockStateRef.keymapRun).toBeTruthy();
    const handled = mockStateRef.keymapRun?.();

    expect(handled).toBe(true);
    expect(onSave).toHaveBeenCalledWith("saved text");
  });

  it("emits changed content through onContentChange", () => {
    const onContentChange = vi.fn();

    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" onContentChange={onContentChange} />
      </ThemeProvider>,
    );

    expect(mockStateRef.updateListener).toBeTruthy();
    mockStateRef.updateListener?.({
      docChanged: true,
      state: {
        doc: {
          toString: () => "next text",
        },
      },
    });

    expect(onContentChange).toHaveBeenCalledWith("next text");
  });

  it("registers syntax highlighting extension", () => {
    render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" />
      </ThemeProvider>,
    );

    const hasSyntaxHighlighting = mockStateRef.latestExtensions.some(
      (extension) => (extension as { __kind?: string }).__kind === "syntaxHighlighting",
    );

    expect(hasSyntaxHighlighting).toBe(true);
  });

  it("keeps one editor instance across rerenders in same theme", () => {
    const onContentChange = vi.fn();
    const { rerender } = render(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="initial" onContentChange={onContentChange} />
      </ThemeProvider>,
    );

    expect(mockStateRef.editorStateCreateCount).toBe(1);

    rerender(
      <ThemeProvider theme={createAppTheme("dark")}>
        <FileEditor path="src/a.ts" content="next" onContentChange={onContentChange} />
      </ThemeProvider>,
    );

    expect(mockStateRef.editorStateCreateCount).toBe(1);
  });
});
