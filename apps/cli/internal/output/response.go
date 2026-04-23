package output

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/jedib0t/go-pretty/v6/table"
)

type RenderData struct {
	Title   string
	Columns []string
	Rows    []map[string]any
	Object  any
}

func PrintResponse(body []byte) error {
	decoded, ok := decodeJSONResponse(body)
	if !ok {
		fmt.Println(string(body))
		return nil
	}

	return PrintAny(decoded)
}

func PrintAny(decoded any) error {
	normalized, ok := normalizeDecoded(decoded)
	if !ok {
		return PrintRenderData(RenderData{Object: decoded})
	}

	return PrintRenderData(inferRenderData(normalized))
}

func PrintRenderData(data RenderData) error {
	if data.Title != "" {
		fmt.Printf("%s:\n", data.Title)
	}

	if data.Rows != nil {
		return printTableRows(data.Rows, data.Columns)
	}

	if data.Object == nil {
		fmt.Println("{}")
		return nil
	}

	pretty, err := json.MarshalIndent(data.Object, "", "  ")
	if err != nil {
		return fmt.Errorf("format response body: %w", err)
	}

	fmt.Println(string(pretty))
	return nil
}

func decodeJSONResponse(body []byte) (any, bool) {
	if len(body) == 0 {
		return map[string]any{}, true
	}

	var decoded any
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, false
	}

	return decoded, true
}

func normalizeDecoded(decoded any) (any, bool) {
	switch decoded.(type) {
	case map[string]any, []any:
		return decoded, true
	}

	encoded, err := json.Marshal(decoded)
	if err != nil {
		return nil, false
	}

	var normalized any
	if err := json.Unmarshal(encoded, &normalized); err != nil {
		return nil, false
	}

	return normalized, true
}

func inferRenderData(decoded any) RenderData {
	if rows, ok := decoded.([]any); ok {
		if mapped, ok := mapRows(rows); ok {
			return RenderData{Rows: mapped}
		}
	}

	if envelope, ok := decoded.(map[string]any); ok {
		if key, rows, ok := extractSingleArrayEnvelope(envelope); ok {
			if mapped, ok := mapRows(rows); ok {
				return RenderData{Title: key, Rows: mapped}
			}
		}
	}

	return RenderData{Object: decoded}
}

func mapRows(rows []any) ([]map[string]any, bool) {
	converted := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		object, ok := row.(map[string]any)
		if !ok {
			return nil, false
		}
		converted = append(converted, object)
	}

	return converted, true
}

func printTableRows(rows []map[string]any, preferredColumns []string) error {
	if len(rows) == 0 {
		fmt.Println("(no results)")
		return nil
	}

	columnSet := map[string]struct{}{}
	for _, row := range rows {
		for key := range row {
			columnSet[key] = struct{}{}
		}
	}

	columns := preferredColumns
	if len(columns) == 0 {
		columns = orderedColumns(columnSet)
	}
	if len(columns) == 0 {
		fmt.Println("(no results)")
		return nil
	}

	writer := table.NewWriter()
	writer.SetStyle(table.StyleLight)
	writer.AppendHeader(toTableRow(columns))
	for _, row := range rows {
		values := make([]string, 0, len(columns))
		for _, column := range columns {
			values = append(values, formatCell(row[column]))
		}
		writer.AppendRow(toTableRow(values))
	}

	fmt.Println(writer.Render())

	return nil
}

func toTableRow(values []string) table.Row {
	row := make(table.Row, 0, len(values))
	for _, value := range values {
		row = append(row, value)
	}

	return row
}

func extractSingleArrayEnvelope(value map[string]any) (string, []any, bool) {
	if len(value) != 1 {
		return "", nil, false
	}

	for key, item := range value {
		rows, ok := item.([]any)
		if !ok {
			return "", nil, false
		}
		return key, rows, true
	}

	return "", nil, false
}

func orderedColumns(columns map[string]struct{}) []string {
	preferred := []string{
		"id",
		"name",
		"memberCount",
		"email",
		"role",
		"scope",
		"organizationId",
		"projectId",
		"nodeId",
		"kind",
		"branch",
		"localPath",
		"repoProvider",
		"repoUrl",
		"createdAt",
		"updatedAt",
	}

	ordered := make([]string, 0, len(columns))
	for _, key := range preferred {
		if _, ok := columns[key]; ok {
			ordered = append(ordered, key)
			delete(columns, key)
		}
	}

	remaining := make([]string, 0, len(columns))
	for key := range columns {
		remaining = append(remaining, key)
	}
	sort.Strings(remaining)

	return append(ordered, remaining...)
}

func formatCell(value any) string {
	switch v := value.(type) {
	case nil:
		return "-"
	case string:
		if strings.TrimSpace(v) == "" {
			return "-"
		}
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case float64:
		if float64(int64(v)) == v {
			return fmt.Sprintf("%d", int64(v))
		}
		return fmt.Sprintf("%g", v)
	default:
		encoded, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		if len(encoded) == 0 {
			return "-"
		}
		return string(encoded)
	}
}
