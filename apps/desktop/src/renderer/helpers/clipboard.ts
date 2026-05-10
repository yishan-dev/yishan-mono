/**
 * Copies text to the system clipboard with error handling.
 *
 * Handles the navigator.clipboard availability check and logs errors
 * instead of throwing, consistent with how clipboard operations are
 * handled throughout the desktop app.
 *
 * @example
 * ```ts
 * await copyToClipboard(filePath);
 * ```
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!navigator.clipboard) {
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error("Failed to copy to clipboard", error);
  }
}
