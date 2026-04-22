package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var apiRefreshCmd = &cobra.Command{
	Use:   "refresh",
	Short: "Refresh access token",
	RunE: func(cmd *cobra.Command, _ []string) error {
		refreshToken, err := cmd.Flags().GetString("refresh-token")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodPost, "/auth/refresh", map[string]string{
			"refreshToken": refreshToken,
		})
	},
}

var apiRevokeCmd = &cobra.Command{
	Use:   "revoke",
	Short: "Revoke refresh token",
	RunE: func(cmd *cobra.Command, _ []string) error {
		refreshToken, err := cmd.Flags().GetString("refresh-token")
		if err != nil {
			return err
		}

		return newAPIClient().doJSON(http.MethodPost, "/auth/revoke", map[string]string{
			"refreshToken": refreshToken,
		})
	},
}

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authentication operations",
}

func init() {
	rootCmd.AddCommand(authCmd)
	authCmd.AddCommand(apiRefreshCmd)
	authCmd.AddCommand(apiRevokeCmd)

	apiRefreshCmd.Flags().String("refresh-token", "", "refresh token")
	apiRevokeCmd.Flags().String("refresh-token", "", "refresh token")
	cobra.CheckErr(apiRefreshCmd.MarkFlagRequired("refresh-token"))
	cobra.CheckErr(apiRevokeCmd.MarkFlagRequired("refresh-token"))
}
