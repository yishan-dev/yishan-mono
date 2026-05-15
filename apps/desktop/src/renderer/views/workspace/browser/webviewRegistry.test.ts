// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { getOrCreateWebview, removeWebviewsForClosedTabs } from "./webviewRegistry";

describe("webviewRegistry", () => {
  afterEach(() => {
    removeWebviewsForClosedTabs(new Set());
  });

  it("reuses the same webview for the same tab", () => {
    const first = getOrCreateWebview("tab-1", "https://example.com");
    const second = getOrCreateWebview("tab-1", "https://other.example");

    expect(second).toBe(first);
    expect(first.getAttribute("src")).toBe("https://example.com");
  });

  it("removes webviews for closed tabs", () => {
    const open = getOrCreateWebview("tab-open", "https://example.com");
    const closed = getOrCreateWebview("tab-closed", "https://example.org");
    document.body.append(open, closed);

    removeWebviewsForClosedTabs(new Set(["tab-open"]));

    expect(document.body.contains(open)).toBe(true);
    expect(document.body.contains(closed)).toBe(false);
  });
});
