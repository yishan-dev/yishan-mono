package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var apiWorkspaceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List project workspaces",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		projectID, err := cmd.Flags().GetString("project-id")
		if err != nil {
			return err
		}

		path := "/orgs/" + orgID + "/projects/" + projectID + "/workspaces"
		return newAPIClient().doJSON(http.MethodGet, path, nil)
	},
}

var apiWorkspaceCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create project workspace",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		projectID, err := cmd.Flags().GetString("project-id")
		if err != nil {
			return err
		}
		nodeID, err := cmd.Flags().GetString("node-id")
		if err != nil {
			return err
		}
		localPath, err := cmd.Flags().GetString("local-path")
		if err != nil {
			return err
		}
		kind, err := cmd.Flags().GetString("kind")
		if err != nil {
			return err
		}
		branch, err := cmd.Flags().GetString("branch")
		if err != nil {
			return err
		}

		payload := map[string]string{
			"nodeId":    nodeID,
			"localPath": localPath,
			"kind":      kind,
		}
		if branch != "" {
			payload["branch"] = branch
		}

		path := "/orgs/" + orgID + "/projects/" + projectID + "/workspaces"
		return newAPIClient().doJSON(http.MethodPost, path, payload)
	},
}

var workspaceCmd = &cobra.Command{Use: "workspace", Short: "Workspace operations"}

func init() {
	rootCmd.AddCommand(workspaceCmd)
	workspaceCmd.AddCommand(apiWorkspaceListCmd)
	workspaceCmd.AddCommand(apiWorkspaceCreateCmd)

	apiWorkspaceListCmd.Flags().String("org-id", "", "organization ID")
	apiWorkspaceListCmd.Flags().String("project-id", "", "project ID")
	cobra.CheckErr(apiWorkspaceListCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiWorkspaceListCmd.MarkFlagRequired("project-id"))

	apiWorkspaceCreateCmd.Flags().String("org-id", "", "organization ID")
	apiWorkspaceCreateCmd.Flags().String("project-id", "", "project ID")
	apiWorkspaceCreateCmd.Flags().String("node-id", "", "node ID")
	apiWorkspaceCreateCmd.Flags().String("local-path", "", "local path")
	apiWorkspaceCreateCmd.Flags().String("kind", "primary", "workspace kind (primary|worktree)")
	apiWorkspaceCreateCmd.Flags().String("branch", "", "branch name for worktree")
	cobra.CheckErr(apiWorkspaceCreateCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiWorkspaceCreateCmd.MarkFlagRequired("project-id"))
	cobra.CheckErr(apiWorkspaceCreateCmd.MarkFlagRequired("node-id"))
	cobra.CheckErr(apiWorkspaceCreateCmd.MarkFlagRequired("local-path"))
}
