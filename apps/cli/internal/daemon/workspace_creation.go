package daemon

type WorkspaceCreation struct {
	NodeID         string
	OrganizationID string
	ProjectID      string
	Kind           string
	Branch         string
	LocalPath      string
}
