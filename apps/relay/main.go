package main

import (
	"os"

	"github.com/rs/zerolog/log"
	"yishan/apps/relay/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		log.Error().Err(err).Msg("command failed")
		os.Exit(1)
	}
}
