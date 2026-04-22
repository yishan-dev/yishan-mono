package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var apiNodeListCmd = &cobra.Command{
	Use:   "list",
	Short: "List organization nodes",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodGet, "/orgs/"+orgID+"/nodes", nil)
	},
}

var apiNodeCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create organization node",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		name, err := cmd.Flags().GetString("name")
		if err != nil {
			return err
		}
		scope, err := cmd.Flags().GetString("scope")
		if err != nil {
			return err
		}
		endpoint, err := cmd.Flags().GetString("endpoint")
		if err != nil {
			return err
		}
		metadataOS, err := cmd.Flags().GetString("metadata-os")
		if err != nil {
			return err
		}
		metadataVersion, err := cmd.Flags().GetString("metadata-version")
		if err != nil {
			return err
		}

		payload := map[string]any{
			"name":  name,
			"scope": scope,
		}
		if endpoint != "" {
			payload["endpoint"] = endpoint
		}
		if metadataOS != "" || metadataVersion != "" {
			metadata := map[string]string{}
			if metadataOS != "" {
				metadata["os"] = metadataOS
			}
			if metadataVersion != "" {
				metadata["version"] = metadataVersion
			}
			payload["metadata"] = metadata
		}

		return newAPIClient().doJSON(http.MethodPost, "/orgs/"+orgID+"/nodes", payload)
	},
}

var apiNodeDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete organization node",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		nodeID, err := cmd.Flags().GetString("node-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodDelete, "/orgs/"+orgID+"/nodes/"+nodeID, nil)
	},
}

var nodeCmd = &cobra.Command{Use: "node", Short: "Node operations"}

func init() {
	rootCmd.AddCommand(nodeCmd)
	nodeCmd.AddCommand(apiNodeListCmd)
	nodeCmd.AddCommand(apiNodeCreateCmd)
	nodeCmd.AddCommand(apiNodeDeleteCmd)

	apiNodeListCmd.Flags().String("org-id", "", "organization ID")
	cobra.CheckErr(apiNodeListCmd.MarkFlagRequired("org-id"))

	apiNodeCreateCmd.Flags().String("org-id", "", "organization ID")
	apiNodeCreateCmd.Flags().String("name", "", "node name")
	apiNodeCreateCmd.Flags().String("scope", "remote", "node scope (local|remote)")
	apiNodeCreateCmd.Flags().String("endpoint", "", "node endpoint URL")
	apiNodeCreateCmd.Flags().String("metadata-os", "", "node OS metadata")
	apiNodeCreateCmd.Flags().String("metadata-version", "", "node version metadata")
	cobra.CheckErr(apiNodeCreateCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiNodeCreateCmd.MarkFlagRequired("name"))

	apiNodeDeleteCmd.Flags().String("org-id", "", "organization ID")
	apiNodeDeleteCmd.Flags().String("node-id", "", "node ID")
	cobra.CheckErr(apiNodeDeleteCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiNodeDeleteCmd.MarkFlagRequired("node-id"))
}
