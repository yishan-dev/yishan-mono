/**
 * Returns true when an event target is an editable element (input, textarea, select, or contentEditable).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const targetElement = target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;

  if (!targetElement) {
    return false;
  }

  if (targetElement.isContentEditable || Boolean(targetElement.closest("[contenteditable='true']"))) {
    return true;
  }

  const tagName = targetElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return Boolean(targetElement.closest("input, textarea, select"));
}

/**
 * Returns true when the current browser active element is editable.
 */
export function isEditableActiveElement(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return isEditableTarget(document.activeElement);
}

/**
 * Returns true when the target is inside the repo file-tree container.
 */
export function isWithinRepoFileTree(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('[data-testid="repo-file-tree-area"]'));
}

/** Returns true when the target is inside the repo/workspace list container. */
export function isWithinRepoWorkspaceList(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('[data-testid="repo-workspace-list"]'));
}
