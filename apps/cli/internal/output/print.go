package output

import (
	"encoding/json"
	"fmt"
)

func PrintResponse(body []byte) error {
	decoded, ok := decodeJSONResponse(body)
	if !ok {
		fmt.Println(string(body))
		return nil
	}

	if isJSONOutputEnabled() {
		return printAsJSON(decoded)
	}

	return PrintAny(decoded)
}

func PrintAny(decoded any) error {
	if isJSONOutputEnabled() {
		return printAsJSON(decoded)
	}

	normalized, ok := normalizeDecoded(decoded)
	if !ok {
		return PrintRenderData(RenderData{Object: decoded})
	}

	return PrintRenderData(inferRenderData(normalized))
}

func PrintRenderData(data RenderData) error {
	if isJSONOutputEnabled() {
		return printAsJSON(renderDataToJSON(data))
	}

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

func printAsJSON(value any) error {
	pretty, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("format response body: %w", err)
	}

	fmt.Println(string(pretty))
	return nil
}

func renderDataToJSON(data RenderData) any {
	if data.Object != nil {
		return data.Object
	}

	if data.Rows != nil {
		if data.Title != "" {
			return map[string]any{data.Title: data.Rows}
		}
		return data.Rows
	}

	if data.Title != "" {
		return map[string]string{"title": data.Title}
	}

	return map[string]any{}
}
