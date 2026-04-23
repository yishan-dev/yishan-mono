import { describe, expect, it } from "vitest";
import {
  extractPathsFromClipboardText,
  extractPathsFromPlainText,
  extractPathsFromUriList,
} from "./fileClipboardPaths";

describe("extractPathsFromUriList", () => {
  it("parses unix and windows file URIs and skips comments", () => {
    const value = [
      "# Finder payload",
      "file:///Users/test/Desktop/report.md",
      "file:///C:/Users/test/Desktop/windows.txt",
      "not-a-file-uri",
    ].join("\n");

    expect(extractPathsFromUriList(value)).toEqual([
      "/Users/test/Desktop/report.md",
      "C:/Users/test/Desktop/windows.txt",
    ]);
  });

  it("parses UNC file URIs and keeps host segment", () => {
    const value = ["file://server/share/design.sketch", "file://localhost/Users/test/Desktop/local.txt"].join("\n");

    expect(extractPathsFromUriList(value)).toEqual(["//server/share/design.sketch", "/Users/test/Desktop/local.txt"]);
  });
});

describe("extractPathsFromPlainText", () => {
  it("parses quoted absolute paths and skips relative lines", () => {
    const value = [
      '"/Users/test/Desktop/quoted.md"',
      "'C:\\Users\\test\\Desktop\\quoted.txt'",
      "relative/path.txt",
      "notes",
    ].join("\n");

    expect(extractPathsFromPlainText(value)).toEqual([
      "/Users/test/Desktop/quoted.md",
      "C:\\Users\\test\\Desktop\\quoted.txt",
    ]);
  });
});

describe("extractPathsFromClipboardText", () => {
  it("deduplicates mixed URI and plain-text path payloads", () => {
    const value = [
      "file:///Users/test/Desktop/report.md",
      "/Users/test/Desktop/report.md",
      "file:///Users/test/Desktop/diagram.png",
      "'/Users/test/Desktop/diagram.png'",
    ].join("\n");

    expect(extractPathsFromClipboardText(value)).toEqual([
      "/Users/test/Desktop/report.md",
      "/Users/test/Desktop/diagram.png",
    ]);
  });
});
