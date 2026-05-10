import { Box, ListSubheader, MenuItem, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { useMemo, useState } from "react";
import { LuFolderGit2, LuGitBranch } from "react-icons/lu";

export type BranchDropdownGroups = {
  localBranches: string[];
  worktreeBranches: string[];
  remoteBranches: string[];
};

type BranchDropdownProps = {
  groups: BranchDropdownGroups;
  selectedValue: string;
  onSelect: (value: string) => void;
  localLabel: string;
  branchesLabel: string;
  worktreesLabel: string;
  remoteLabel: string;
  emptyLocalLabel: string;
  emptyWorktreeLabel: string;
  emptyRemoteLabel: string;
};

type SourceBranchOption = {
  key: string;
  value: string;
  label: string;
  indent: number;
  kind: "branch" | "worktree";
};

/** Builds one list of branch dropdown options with an empty-state fallback. */
function buildBranchOptions(
  branches: string[],
  prefix: string,
  indent: number,
  kind: "branch" | "worktree",
  emptyLabel: string,
): SourceBranchOption[] {
  if (branches.length === 0) {
    return [{ key: `${prefix}-empty`, value: "", label: emptyLabel, indent, kind }];
  }
  return branches.map((branch) => ({
    key: `${prefix}-${branch}`,
    value: branch,
    label: branch,
    indent,
    kind,
  }));
}

export function BranchDropdown({
  groups,
  selectedValue,
  onSelect,
  localLabel,
  branchesLabel,
  worktreesLabel,
  remoteLabel,
  emptyLocalLabel,
  emptyWorktreeLabel,
  emptyRemoteLabel,
}: BranchDropdownProps) {
  const inferredInitialSection = useMemo<"local" | "remote">(() => {
    if (groups.remoteBranches.includes(selectedValue)) {
      return "remote";
    }
    return "local";
  }, [groups.remoteBranches, selectedValue]);
  const [activeSection, setActiveSection] = useState<"local" | "remote">(inferredInitialSection);

  const localOptions = buildBranchOptions(groups.localBranches, "local", 4, "branch", emptyLocalLabel);
  const worktreeOptions = buildBranchOptions(groups.worktreeBranches, "worktree", 4, "worktree", emptyWorktreeLabel);
  const remoteOptions = buildBranchOptions(groups.remoteBranches, "remote", 2, "branch", emptyRemoteLabel);

  const renderOption = (option: SourceBranchOption) => (
    <MenuItem
      key={option.key}
      selected={option.value === selectedValue}
      onClick={() => {
        if (option.value) {
          onSelect(option.value);
        }
      }}
      sx={{ pl: option.indent, pr: 1, maxWidth: "100%", overflow: "hidden" }}
      disabled={!option.value}
    >
      <Tooltip title={option.label} placement="top" arrow>
        <Box
          component="span"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0, width: "100%", maxWidth: "100%" }}
        >
          <Box component="span" sx={{ display: "inline-flex", flexShrink: 0 }}>
            {option.kind === "worktree" ? <LuFolderGit2 size={14} /> : <LuGitBranch size={14} />}
          </Box>
          <Typography
            variant="body2"
            noWrap
            sx={{ display: "block", flex: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {option.label}
          </Typography>
        </Box>
      </Tooltip>
    </MenuItem>
  );

  return (
    <>
      <ListSubheader disableSticky disableGutters sx={{ px: 1, py: 0.5, lineHeight: "normal", bgcolor: "background.paper" }}>
        <Tabs
          value={activeSection}
          onChange={(_event, nextValue: "local" | "remote") => setActiveSection(nextValue)}
          variant="fullWidth"
          sx={{ minHeight: 24, "& .MuiTab-root": { minHeight: 24, py: 0, textTransform: "none", fontSize: 11 } }}
        >
          <Tab value="local" label={localLabel} />
          <Tab value="remote" label={remoteLabel} />
        </Tabs>
      </ListSubheader>
      {activeSection === "local" ? (
        <>
          <ListSubheader
            disableSticky
            sx={{ pl: 3, fontSize: 10, lineHeight: 1.4, textTransform: "uppercase", color: "text.disabled" }}
          >
            {branchesLabel}
          </ListSubheader>
          {localOptions.map(renderOption)}
          <ListSubheader
            disableSticky
            sx={{ pl: 3, fontSize: 10, lineHeight: 1.4, textTransform: "uppercase", color: "text.disabled" }}
          >
            {worktreesLabel}
          </ListSubheader>
          {worktreeOptions.map(renderOption)}
        </>
      ) : (
        remoteOptions.map(renderOption)
      )}
    </>
  );
}
