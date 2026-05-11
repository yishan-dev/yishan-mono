package relay

import "errors"

var (
	// ErrNodeOffline is returned when attempting to send to a disconnected node.
	ErrNodeOffline = errors.New("node is offline")
)
