package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var apiProjectListCmd = &cobra.Command{
	Use:   "list",
	Short: "List organization projects",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodGet, "/orgs/"+orgID+"/projects", nil)
	},
}

var apiProjectCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create organization project",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		name, err := cmd.Flags().GetString("name")
		if err != nil {
			return err
		}
		sourceTypeHint, err := cmd.Flags().GetString("source-type-hint")
		if err != nil {
			return err
		}
		repoURL, err := cmd.Flags().GetString("repo-url")
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

		payload := map[string]string{
			"name": name,
		}
		if sourceTypeHint != "" {
			payload["sourceTypeHint"] = sourceTypeHint
		}
		if repoURL != "" {
			payload["repoUrl"] = repoURL
		}
		if nodeID != "" {
			payload["nodeId"] = nodeID
		}
		if localPath != "" {
			payload["localPath"] = localPath
		}

		return newAPIClient().doJSON(http.MethodPost, "/orgs/"+orgID+"/projects", payload)
	},
}

var projectCmd = &cobra.Command{Use: "project", Short: "Project operations"}

func init() {
	rootCmd.AddCommand(projectCmd)
	projectCmd.AddCommand(apiProjectListCmd)
	projectCmd.AddCommand(apiProjectCreateCmd)

	apiProjectListCmd.Flags().String("org-id", "", "organization ID")
	cobra.CheckErr(apiProjectListCmd.MarkFlagRequired("org-id"))

	apiProjectCreateCmd.Flags().String("org-id", "", "organization ID")
	apiProjectCreateCmd.Flags().String("name", "", "project name")
	apiProjectCreateCmd.Flags().String("source-type-hint", "", "source type hint (unknown|git-local)")
	apiProjectCreateCmd.Flags().String("repo-url", "", "repository URL")
	apiProjectCreateCmd.Flags().String("node-id", "", "node ID")
	apiProjectCreateCmd.Flags().String("local-path", "", "local path")
	cobra.CheckErr(apiProjectCreateCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiProjectCreateCmd.MarkFlagRequired("name"))
}
