package cmd

import (
	"yishan/apps/cli/internal/output"
	"yishan/apps/cli/internal/provision"

	"github.com/spf13/cobra"
)

var workspaceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List project workspaces",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := resolveOrgID(cmd)
		if err != nil {
			return err
		}
		projectID, err := cmd.Flags().GetString("project-id")
		if err != nil {
			return err
		}

		response, err := apiClient().ListWorkspaces(orgID, projectID)
		if err != nil {
			return err
		}

		return output.PrintAny(response)
	},
}

var workspaceCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create project workspace",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := resolveOrgID(cmd)
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

		service := provision.NewForRuntime(apiClient(), provision.RuntimeConfig{
			ConfigPath: appConfig.ConfigPath,
			Daemon: provision.DaemonAuthConfig{
				Host:        appConfig.Daemon.Host,
				Port:        appConfig.Daemon.Port,
				JWTSecret:   appConfig.Daemon.JWTSecret,
				JWTIssuer:   appConfig.Daemon.JWTIssuer,
				JWTAudience: appConfig.Daemon.JWTAudience,
				JWTRequired: appConfig.Daemon.JWTRequired,
			},
		})

		body, err := service.Create(cmd.Context(), provision.CreateRequest{
			OrganizationID: orgID,
			ProjectID:      projectID,
			NodeID:         nodeID,
			LocalPath:      localPath,
			Kind:           kind,
			Branch:         branch,
		})
		if err != nil {
			return err
		}

		return output.PrintResponse(body)
	},
}

var workspaceCmd = &cobra.Command{Use: "workspace", Short: "Workspace operations"}

func init() {
	rootCmd.AddCommand(workspaceCmd)
	workspaceCmd.AddCommand(workspaceListCmd)
	workspaceCmd.AddCommand(workspaceCreateCmd)

	workspaceListCmd.Flags().String("org-id", "", "organization ID")
	workspaceListCmd.Flags().String("project-id", "", "project ID")
	cobra.CheckErr(workspaceListCmd.MarkFlagRequired("project-id"))

	workspaceCreateCmd.Flags().String("org-id", "", "organization ID")
	workspaceCreateCmd.Flags().String("project-id", "", "project ID")
	workspaceCreateCmd.Flags().String("node-id", "", "node ID")
	workspaceCreateCmd.Flags().String("local-path", "", "local path")
	workspaceCreateCmd.Flags().String("kind", "primary", "workspace kind (primary|worktree)")
	workspaceCreateCmd.Flags().String("branch", "", "branch name for worktree")
	cobra.CheckErr(workspaceCreateCmd.MarkFlagRequired("project-id"))
	cobra.CheckErr(workspaceCreateCmd.MarkFlagRequired("node-id"))
	cobra.CheckErr(workspaceCreateCmd.MarkFlagRequired("local-path"))
}
