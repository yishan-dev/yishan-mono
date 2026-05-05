import * as monaco from "monaco-editor";

// Configure Monaco to use locally bundled workers instead of loading from CDN.
// The `new Worker(new URL(..., import.meta.url))` pattern is a web standard that
// Vite detects and bundles as separate chunks at build time.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "json") {
      return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url), {
        type: "module",
      });
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker.js", import.meta.url), {
        type: "module",
      });
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker.js", import.meta.url), {
        type: "module",
      });
    }
    if (label === "typescript" || label === "javascript") {
      return new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker.js", import.meta.url), {
        type: "module",
      });
    }
    return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), {
      type: "module",
    });
  },
};

// Configure TypeScript/JavaScript defaults to suppress errors for unresolved
// imports. Monaco runs in isolation without access to the user's filesystem,
// so it cannot resolve relative imports from the project being edited.
const tsDefaults = monaco.languages.typescript.typescriptDefaults;
const jsDefaults = monaco.languages.typescript.javascriptDefaults;

const sharedCompilerOptions: monaco.languages.typescript.CompilerOptions = {
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  allowJs: true,
  allowNonTsExtensions: true,
  noEmit: true,
  // Suppress diagnostics for modules that cannot be found.
  noResolve: true,
};

tsDefaults.setCompilerOptions(sharedCompilerOptions);
jsDefaults.setCompilerOptions(sharedCompilerOptions);

// Disable semantic validation (type errors for unresolved modules) but
// keep syntax validation so obvious typos are still flagged.
tsDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});
jsDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
});

/** The locally bundled Monaco editor namespace. */
export { monaco };
