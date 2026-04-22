package apiclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL string
	token   string
	client  *http.Client
}

func New(baseURL string, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   strings.TrimSpace(token),
		client: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c *Client) DoJSON(method string, path string, body any) error {
	responseBody, err := c.do(method, path, body)
	if err != nil {
		return err
	}

	if len(responseBody) == 0 {
		fmt.Println("{}")
		return nil
	}

	var decoded any
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		fmt.Println(string(responseBody))
		return nil
	}

	pretty, err := json.MarshalIndent(decoded, "", "  ")
	if err != nil {
		return fmt.Errorf("format response body: %w", err)
	}

	fmt.Println(string(pretty))
	return nil
}

func (c *Client) DoRaw(method string, path string, body any) ([]byte, error) {
	return c.do(method, path, body)
}

func (c *Client) do(method string, path string, body any) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(payload)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("request failed: %s %s -> %s\n%s", method, path, res.Status, string(responseBody))
	}

	return responseBody, nil
}
