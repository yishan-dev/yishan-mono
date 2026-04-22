package provision

import (
	"fmt"
	"net/url"
	"strings"
)

type workspaceListResponse struct {
	Workspaces []workspaceItem `json:"workspaces"`
}

type workspaceCreateResponse struct {
	Workspace workspaceItem `json:"workspace"`
}

type workspaceItem struct {
	ID        string `json:"id"`
	NodeID    string `json:"nodeId"`
	Kind      string `json:"kind"`
	Branch    string `json:"branch"`
	LocalPath string `json:"localPath"`
}

type nodeListResponse struct {
	Nodes []nodeItem `json:"nodes"`
}

type nodeItem struct {
	ID       string `json:"id"`
	Scope    string `json:"scope"`
	Endpoint string `json:"endpoint"`
}

type daemonWorkspaceOpenResult struct {
	ID   string `json:"id"`
	Path string `json:"path"`
}

func (n nodeItem) daemonWSURL(defaultHost string, defaultPort int) (string, error) {
	if strings.TrimSpace(n.Endpoint) == "" {
		return defaultDaemonWSURL(defaultHost, defaultPort), nil
	}

	endpointURL, err := url.Parse(n.Endpoint)
	if err != nil {
		return "", fmt.Errorf("invalid node endpoint %q: %w", n.Endpoint, err)
	}

	switch endpointURL.Scheme {
	case "http":
		endpointURL.Scheme = "ws"
	case "https":
		endpointURL.Scheme = "wss"
	case "ws", "wss":
	default:
		return "", fmt.Errorf("unsupported node endpoint scheme %q", endpointURL.Scheme)
	}
	if endpointURL.Path == "" || endpointURL.Path == "/" {
		endpointURL.Path = "/ws"
	}

	return endpointURL.String(), nil
}

func defaultDaemonWSURL(host string, port int) string {
	scheme := "ws"
	if port == 443 {
		scheme = "wss"
	}
	return fmt.Sprintf("%s://%s:%d/ws", scheme, host, port)
}
