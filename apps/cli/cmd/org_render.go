package cmd

import "yishan/apps/cli/internal/output"
import "yishan/apps/cli/internal/api"

func toOrgListRenderData(response api.ListOrganizationsResponse) (output.RenderData, error) {
	rows := make([]map[string]any, 0, len(response.Organizations))
	for _, organization := range response.Organizations {
		rows = append(rows, map[string]any{
			"id":          organization.ID,
			"name":        organization.Name,
			"memberCount": len(organization.Members),
			"createdAt":   organization.CreatedAt,
			"updatedAt":   organization.UpdatedAt,
		})
	}

	return output.RenderData{
		Title:   "organizations",
		Columns: []string{"id", "name", "memberCount", "createdAt", "updatedAt"},
		Rows:    rows,
	}, nil
}
