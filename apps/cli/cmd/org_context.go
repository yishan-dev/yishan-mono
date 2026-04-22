package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

func resolveOrgID(cmd *cobra.Command) (string, error) {
	orgID, err := cmd.Flags().GetString("org-id")
	if err != nil {
		return "", err
	}
	if orgID != "" {
		return orgID, nil
	}
	if appConfig.CurrentOrgID != "" {
		return appConfig.CurrentOrgID, nil
	}

	return "", fmt.Errorf("no active org: run `yishan org use <org-id>` or pass --org-id")
}
