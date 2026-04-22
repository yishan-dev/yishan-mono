package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var apiOrgListCmd = &cobra.Command{
	Use:   "list",
	Short: "List organizations",
	RunE: func(_ *cobra.Command, _ []string) error {
		return newAPIClient().doJSON(http.MethodGet, "/orgs", nil)
	},
}

var apiOrgCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create organization",
	RunE: func(cmd *cobra.Command, _ []string) error {
		name, err := cmd.Flags().GetString("name")
		if err != nil {
			return err
		}
		memberUserIDs, err := cmd.Flags().GetStringSlice("member-user-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodPost, "/orgs", map[string]any{
			"name":          name,
			"memberUserIds": memberUserIDs,
		})
	},
}

var apiOrgDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete organization",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodDelete, "/orgs/"+orgID, nil)
	},
}

var apiOrgMemberAddCmd = &cobra.Command{
	Use:   "add",
	Short: "Add organization member",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		userID, err := cmd.Flags().GetString("user-id")
		if err != nil {
			return err
		}
		role, err := cmd.Flags().GetString("role")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodPost, "/orgs/"+orgID+"/members", map[string]string{
			"userId": userID,
			"role":   role,
		})
	},
}

var apiOrgMemberRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove organization member",
	RunE: func(cmd *cobra.Command, _ []string) error {
		orgID, err := cmd.Flags().GetString("org-id")
		if err != nil {
			return err
		}
		userID, err := cmd.Flags().GetString("user-id")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodDelete, "/orgs/"+orgID+"/members/"+userID, nil)
	},
}

var orgCmd = &cobra.Command{Use: "org", Short: "Organization operations"}
var orgMemberCmd = &cobra.Command{Use: "member", Short: "Organization member operations"}

func init() {
	rootCmd.AddCommand(orgCmd)

	orgCmd.AddCommand(apiOrgListCmd)
	orgCmd.AddCommand(apiOrgCreateCmd)
	orgCmd.AddCommand(apiOrgDeleteCmd)
	orgCmd.AddCommand(orgMemberCmd)
	orgMemberCmd.AddCommand(apiOrgMemberAddCmd)
	orgMemberCmd.AddCommand(apiOrgMemberRemoveCmd)

	apiOrgCreateCmd.Flags().String("name", "", "organization name")
	apiOrgCreateCmd.Flags().StringSlice("member-user-id", []string{}, "additional member user id")
	cobra.CheckErr(apiOrgCreateCmd.MarkFlagRequired("name"))

	apiOrgDeleteCmd.Flags().String("org-id", "", "organization ID")
	cobra.CheckErr(apiOrgDeleteCmd.MarkFlagRequired("org-id"))

	apiOrgMemberAddCmd.Flags().String("org-id", "", "organization ID")
	apiOrgMemberAddCmd.Flags().String("user-id", "", "member user ID")
	apiOrgMemberAddCmd.Flags().String("role", "member", "member role (member|admin)")
	cobra.CheckErr(apiOrgMemberAddCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiOrgMemberAddCmd.MarkFlagRequired("user-id"))

	apiOrgMemberRemoveCmd.Flags().String("org-id", "", "organization ID")
	apiOrgMemberRemoveCmd.Flags().String("user-id", "", "member user ID")
	cobra.CheckErr(apiOrgMemberRemoveCmd.MarkFlagRequired("org-id"))
	cobra.CheckErr(apiOrgMemberRemoveCmd.MarkFlagRequired("user-id"))
}
