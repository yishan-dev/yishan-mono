package output

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/jedib0t/go-pretty/v6/table"
)

func PrintResponse(body []byte) error {
	if len(body) == 0 {
		fmt.Println("{}")
		return nil
	}

	var decoded any
	if err := json.Unmarshal(body, &decoded); err != nil {
		fmt.Println(string(body))
		return nil
	}

	if rows, ok := decoded.([]any); ok {
		if printed, err := printTable(rows); err != nil {
			return err
		} else if printed {
			return nil
		}
	}

	if envelope, ok := decoded.(map[string]any); ok {
		if key, rows, ok := extractSingleArrayEnvelope(envelope); ok {
			fmt.Printf("%s:\n", key)
			if printed, err := printTable(rows); err != nil {
				return err
			} else if printed {
				return nil
			}
		}
	}

	pretty, err := json.MarshalIndent(decoded, "", "  ")
	if err != nil {
		return fmt.Errorf("format response body: %w", err)
	}

	fmt.Println(string(pretty))
	return nil
}

func printTable(rows []any) (bool, error) {
	if len(rows) == 0 {
		fmt.Println("(no results)")
		return true, nil
	}

	converted := make([]map[string]any, 0, len(rows))
	columnSet := map[string]struct{}{}
	for _, row := range rows {
		object, ok := row.(map[string]any)
		if !ok {
			return false, nil
		}
		converted = append(converted, object)
		for key := range object {
			columnSet[key] = struct{}{}
		}
	}

	columns := orderedColumns(columnSet)
	if len(columns) == 0 {
		fmt.Println("(no results)")
		return true, nil
	}

	writer := table.NewWriter()
	writer.SetStyle(table.StyleLight)
	writer.AppendHeader(toTableRow(columns))
	for _, row := range converted {
		values := make([]string, 0, len(columns))
		for _, column := range columns {
			values = append(values, formatCell(row[column]))
		}
		writer.AppendRow(toTableRow(values))
	}

	fmt.Println(writer.Render())

	return true, nil
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
