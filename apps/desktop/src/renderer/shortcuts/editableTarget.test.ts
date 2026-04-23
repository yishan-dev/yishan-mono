// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { isEditableTarget } from "./editableTarget";

describe("isEditableTarget", () => {
  it("returns true for nested nodes inside input-like controls", () => {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    wrapper.appendChild(input);

    const textNode = document.createTextNode("value");
    input.appendChild(textNode);

    expect(isEditableTarget(textNode)).toBe(true);
  });

  it("returns true for nested nodes inside contenteditable root", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.appendChild(child);

    expect(isEditableTarget(child)).toBe(true);
  });

  it("returns false for non-editable regular elements", () => {
    const element = document.createElement("div");
    expect(isEditableTarget(element)).toBe(false);
  });
});
