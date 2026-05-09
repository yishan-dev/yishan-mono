import { describe, expect, it, vi } from "vitest";

const typescriptDefaults = {
  setCompilerOptions: vi.fn(),
  setDiagnosticsOptions: vi.fn(),
};
const javascriptDefaults = {
  setCompilerOptions: vi.fn(),
  setDiagnosticsOptions: vi.fn(),
};

const workerMock = vi.fn();

vi.stubGlobal("Worker", workerMock);
vi.stubGlobal("self", globalThis);

vi.mock("monaco-editor", () => ({
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    typescript: {
      typescriptDefaults,
      javascriptDefaults,
      ScriptTarget: { ESNext: 99 },
      ModuleKind: { ESNext: 99 },
      ModuleResolutionKind: { NodeJs: 2 },
      JsxEmit: { ReactJSX: 4 },
    },
  },
  editor: {
    defineTheme: vi.fn(),
  },
}));
vi.mock("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution", () => ({}));

describe("monacoSetup", () => {
  it("configures TypeScript and JavaScript services for JSX/TSX", async () => {
    await import("./monacoSetup");

    expect(typescriptDefaults.setCompilerOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        allowJs: true,
        allowNonTsExtensions: true,
        jsx: 4,
      }),
    );
    expect(javascriptDefaults.setCompilerOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        allowJs: true,
        allowNonTsExtensions: true,
        jsx: 4,
      }),
    );
  });

  it("routes TypeScript and JavaScript language modes through the TypeScript worker", async () => {
    await import("./monacoSetup");

    const environment = self.MonacoEnvironment as { getWorker: (workerId: string, label: string) => unknown };
    environment.getWorker("1", "typescript");
    environment.getWorker("2", "javascript");

    expect(workerMock).toHaveBeenCalledTimes(2);
    expect(workerMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pathname: expect.stringContaining("ts.worker") }),
      { type: "module" },
    );
    expect(workerMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pathname: expect.stringContaining("ts.worker") }),
      { type: "module" },
    );
  });
});
