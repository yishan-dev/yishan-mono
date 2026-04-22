package cmd

import "github.com/spf13/cobra"

var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check API health",
	RunE: func(_ *cobra.Command, _ []string) error {
		return apiClient().Health()
	},
}

var whoamiCmd = &cobra.Command{
	Use:     "whoami",
	Aliases: []string{"me"},
	Short:   "Show current authenticated user",
	RunE: func(_ *cobra.Command, _ []string) error {
		return apiClient().WhoAmI()
	},
}

func init() {
	rootCmd.AddCommand(healthCmd)
	rootCmd.AddCommand(whoamiCmd)
}
