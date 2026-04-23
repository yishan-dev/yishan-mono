import { describe, expect, it } from "vitest";
import { getFileTreeIcon } from "./fileTreeIcons";

describe("getFileTreeIcon", () => {
  it("uses the html icon for html files", () => {
    expect(getFileTreeIcon("src/index.html", false)).toContain("/material-icons/html.svg");
  });

  it("uses the yaml icon for yaml files", () => {
    expect(getFileTreeIcon("src/index.yaml", false)).toContain("/material-icons/yaml.svg");
    expect(getFileTreeIcon("src/index.yml", false)).toContain("/material-icons/yaml.svg");
  });

  it("uses the php icon for php files", () => {
    expect(getFileTreeIcon("src/index.php", false)).toContain("/material-icons/php.svg");
  });

  it("uses the tex icon for tex files", () => {
    expect(getFileTreeIcon("src/index.tex", false)).toContain("/material-icons/tex.svg");
  });

  it("uses the typescript icon for ts files", () => {
    expect(getFileTreeIcon("src/index.ts", false)).toContain("/material-icons/typescript.svg");
  });

  it("uses the typescript definition icon for d.ts files", () => {
    expect(getFileTreeIcon("src/index.d.ts", false)).toContain("/material-icons/typescript-def.svg");
  });
});
