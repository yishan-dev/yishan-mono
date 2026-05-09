const ISSUE_URL_PATTERNS: RegExp[] = [
  /^https?:\/\/linear\.app\/[^/]+\/issue\//i,
  /^https?:\/\/[^/]+\.atlassian\.net\/browse\/[A-Z][A-Z0-9]+-\d+(?:[/?#].*)?$/i,
  /^https?:\/\/[^/]+\.atlassian\.net\/jira\/software\/c\/projects\/[^/]+\/issues\/[A-Z][A-Z0-9]+-\d+(?:[/?#].*)?$/i,
  /^https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+(?:[/?#].*)?$/i,
  /^https?:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+(?:[/?#].*)?$/i,
  /^https?:\/\/app\.shortcut\.com\/[^/]+\/(?:story|epic)\/\d+(?:[/?#].*)?$/i,
  /^https?:\/\/[^/]+\.youtrack\.cloud\/issue\/[A-Z][A-Z0-9]+-\d+(?:[/?#].*)?$/i,
];

/** Returns true when one URL points to a known issue tracker issue or pull request. */
export function isIssueTrackerUrl(url: string): boolean {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return false;
  }

  return ISSUE_URL_PATTERNS.some((pattern) => pattern.test(normalizedUrl));
}
