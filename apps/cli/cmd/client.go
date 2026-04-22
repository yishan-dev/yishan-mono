package cmd

import "yishan/apps/cli/internal/api"

func apiClient() *api.Client {
	return api.NewRuntimeClient(&appConfig)
}
