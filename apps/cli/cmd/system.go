package cmd

import (
	"net/http"

	"github.com/spf13/cobra"
)

var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check API health",
	RunE: func(_ *cobra.Command, _ []string) error {
		return apiClient().DoJSON(http.MethodGet, "/health", nil)
	},
}

var whoamiCmd = &cobra.Command{
	Use:     "whoami",
	Aliases: []string{"me"},
	Short:   "Show current authenticated user",
	RunE: func(_ *cobra.Command, _ []string) error {
		return apiClient().DoJSON(http.MethodGet, "/me", nil)
	},
}

func init() {
	rootCmd.AddCommand(healthCmd)
	rootCmd.AddCommand(whoamiCmd)
}
