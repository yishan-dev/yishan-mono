import { describe, expect, it } from "vitest";
import {
  buildHydratedStateFromApiData,
  normalizeCreateRepoInput,
  readPersistedWorkspacePreferencesByOrg,
} from "./projectHelpers";

describe("projectHelpers", () => {
  it("normalizes create-repo input based on source", () => {
    expect(
      normalizeCreateRepoInput({
        source: "local",
        path: "  /tmp/repo  ",
        gitUrl: "  https://example.com/repo.git  ",
      }),
    ).toEqual({
      normalizedPath: "/tmp/repo",
      normalizedGitUrl: "https://example.com/repo.git",
      resolvedPath: "/tmp/repo",
    });

    expect(
      normalizeCreateRepoInput({
        source: "remote",
        path: "  /fallback/path  ",
        gitUrl: " https://example.com/repo.git ",
      }),
    ).toEqual({
      normalizedPath: "/fallback/path",
      normalizedGitUrl: "https://example.com/repo.git",
      resolvedPath: "https://example.com/repo.git",
    });
  });

  it("reads persisted organization workspace preferences and ignores invalid payloads", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({
          state: {
            organizationPreferencesById: {
              "org-1": {
                selectedProjectId: "repo-1",
                selectedWorkspaceId: "workspace-1",
                displayProjectIds: ["repo-1", "repo-2", 3],
              },
            },
          },
        }),
    } as unknown as Storage;

    expect(readPersistedWorkspacePreferencesByOrg(storage, "org-1")).toEqual({
      selectedProjectId: "repo-1",
      selectedWorkspaceId: "workspace-1",
      displayProjectIds: ["repo-1", "repo-2"],
      lastUsedExternalAppId: undefined,
    });

    const invalidStorage = {
      getItem: () => "not json",
    } as unknown as Storage;

    expect(readPersistedWorkspacePreferencesByOrg(invalidStorage, "org-1")).toBeUndefined();
  });

  it("falls back to showing all repos when persisted display ids are stale", () => {
    const initialState = {
      projects: [],
      workspaces: [],
      gitChangesCountByWorkspaceId: {},
      gitChangeTotalsByWorkspaceId: {},
      selectedProjectId: "",
      selectedWorkspaceId: "",
      displayProjectIds: [],
      organizationPreferencesById: {
        "org-1": {
          displayProjectIds: ["missing-repo-id"],
        },
      },
    };

    const hydrated = buildHydratedStateFromApiData(
      initialState,
      "org-1",
      [
        {
          id: "repo-1",
          name: "Repo 1",
        },
      ],
      [],
    );

    expect(hydrated.displayProjectIds).toEqual(["repo-1"]);
  });

  it("keeps explicit empty persisted display ids", () => {
    const initialState = {
      projects: [],
      workspaces: [],
      gitChangesCountByWorkspaceId: {},
      gitChangeTotalsByWorkspaceId: {},
      selectedProjectId: "",
      selectedWorkspaceId: "",
      displayProjectIds: [],
      organizationPreferencesById: {
        "org-1": {
          displayProjectIds: [],
        },
      },
    };

    const hydrated = buildHydratedStateFromApiData(
      initialState,
      "org-1",
      [
        {
          id: "repo-1",
          name: "Repo 1",
        },
      ],
      [],
    );

    expect(hydrated.displayProjectIds).toEqual([]);
  });
});
