package api

type CreateOrganizationInput struct {
	Name          string
	MemberUserIDs []string
}

type CreateNodeInput struct {
	Name     string
	Scope    string
	Endpoint string
	Metadata map[string]string
}

type CreateProjectInput struct {
	Name           string
	SourceTypeHint string
	RepoURL        string
	NodeID         string
	LocalPath      string
}

func (c *Client) Health() error {
	return c.DoJSON("GET", "/health", nil)
}

func (c *Client) WhoAmI() error {
	return c.DoJSON("GET", "/me", nil)
}

func (c *Client) ListOrganizations() error {
	return c.DoJSON("GET", "/orgs", nil)
}

func (c *Client) CreateOrganization(input CreateOrganizationInput) error {
	return c.DoJSON("POST", "/orgs", map[string]any{
		"name":          input.Name,
		"memberUserIds": input.MemberUserIDs,
	})
}

func (c *Client) DeleteOrganization(orgID string) error {
	return c.DoJSON("DELETE", "/orgs/"+orgID, nil)
}

func (c *Client) AddOrganizationMember(orgID string, userID string, role string) error {
	return c.DoJSON("POST", "/orgs/"+orgID+"/members", map[string]string{
		"userId": userID,
		"role":   role,
	})
}

func (c *Client) RemoveOrganizationMember(orgID string, userID string) error {
	return c.DoJSON("DELETE", "/orgs/"+orgID+"/members/"+userID, nil)
}

func (c *Client) ListNodes(orgID string) error {
	return c.DoJSON("GET", "/orgs/"+orgID+"/nodes", nil)
}

func (c *Client) CreateNode(orgID string, input CreateNodeInput) error {
	payload := map[string]any{
		"name":  input.Name,
		"scope": input.Scope,
	}
	if input.Endpoint != "" {
		payload["endpoint"] = input.Endpoint
	}
	if len(input.Metadata) > 0 {
		payload["metadata"] = input.Metadata
	}

	return c.DoJSON("POST", "/orgs/"+orgID+"/nodes", payload)
}

func (c *Client) DeleteNode(orgID string, nodeID string) error {
	return c.DoJSON("DELETE", "/orgs/"+orgID+"/nodes/"+nodeID, nil)
}

func (c *Client) ListProjects(orgID string) error {
	return c.DoJSON("GET", "/orgs/"+orgID+"/projects", nil)
}

func (c *Client) CreateProject(orgID string, input CreateProjectInput) error {
	payload := map[string]string{
		"name": input.Name,
	}
	if input.SourceTypeHint != "" {
		payload["sourceTypeHint"] = input.SourceTypeHint
	}
	if input.RepoURL != "" {
		payload["repoUrl"] = input.RepoURL
	}
	if input.NodeID != "" {
		payload["nodeId"] = input.NodeID
	}
	if input.LocalPath != "" {
		payload["localPath"] = input.LocalPath
	}

	return c.DoJSON("POST", "/orgs/"+orgID+"/projects", payload)
}

func (c *Client) ListWorkspaces(orgID string, projectID string) error {
	return c.DoJSON("GET", "/orgs/"+orgID+"/projects/"+projectID+"/workspaces", nil)
}

func (c *Client) RefreshToken(refreshToken string) error {
	return c.DoJSON("POST", "/auth/refresh", map[string]string{
		"refreshToken": refreshToken,
	})
}

func (c *Client) RevokeToken(refreshToken string) error {
	return c.DoJSON("POST", "/auth/revoke", map[string]string{
		"refreshToken": refreshToken,
	})
}
