package daemon

import "time"

func nowRFC3339Nano() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}
