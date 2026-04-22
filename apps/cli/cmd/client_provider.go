package cmd

import (
	"yishan/apps/cli/internal/apiclient"
)

func apiClient() *apiclient.Client {
	return apiclient.New(appConfig.API.BaseURL, appConfig.API.Token)
}
