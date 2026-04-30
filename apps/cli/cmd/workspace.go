package cmd

import (
	"fmt"
	"strings"

	"yishan/apps/cli/internal/output"
	"yishan/apps/cli/internal/provision"
	cliruntime "yishan/apps/cli/internal/runtime"

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

		response, err := cliruntime.APIClient().ListWorkspaces(orgID, projectID)
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
		sourceBranch, err := cmd.Flags().GetString("source-branch")
		if err != nil {
			return err
		}
		name, err := cmd.Flags().GetString("name")
		if err != nil {
			return err
		}
		if kind == "primary" && strings.TrimSpace(localPath) == "" {
			return fmt.Errorf("local-path is required for primary workspaces")
		}

		provisioner := provision.NewRuntimeProvisioner(cliruntime.APIClient(), provision.RuntimeConfig{
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

		response, err := provisioner.CreateWorkspace(cmd.Context(), provision.CreateWorkspaceRequest{
			OrganizationID: orgID,
			ProjectID:      projectID,
			LocalPath:      localPath,
			Kind:           kind,
			Branch:         branch,
			SourceBranch:   sourceBranch,
			WorkspaceName:  name,
		})
		if err != nil {
			return err
		}

		return output.PrintAny(response)
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
	workspaceCreateCmd.Flags().String("local-path", "", "local path")
	workspaceCreateCmd.Flags().String("kind", "primary", "workspace kind (primary|worktree)")
	workspaceCreateCmd.Flags().String("branch", "", "branch name for worktree")
	workspaceCreateCmd.Flags().String("source-branch", "", "source branch for worktree")
	workspaceCreateCmd.Flags().String("name", "", "workspace name for worktree path")
	cobra.CheckErr(workspaceCreateCmd.MarkFlagRequired("project-id"))
}
