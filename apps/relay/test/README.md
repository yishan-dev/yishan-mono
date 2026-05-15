# Relay Terminal Test

A browser-based test page for verifying end-to-end terminal streaming through the relay.

## Prerequisites

1. **API service** running (for node registration and relay token minting).
2. **Relay** running:
   ```bash
   cd apps/relay
   JWT_SECRET=<same-as-api-service> RELAY_API_TOKEN=dev-token go run . serve
   ```
3. **Daemon** running with relay enabled:
   ```bash
   cd apps/cli
   go run . daemon run --relay-enabled --relay-url http://127.0.0.1:8788
   ```
4. Confirm relay logs show `node connected`.

## Run the test page

```bash
cd apps/relay/test
npx http-server -p 3000
```

Open http://localhost:3000 in your browser.

## Usage

1. **Connect** — fill in:
   - Relay URL: `ws://127.0.0.1:8788`
   - Node ID: your daemon's node ID (check relay metrics or daemon logs)
   - API Token: `dev-token` (pre-filled)
   - Click **Connect**

2. **New Session** — after connecting, a second row appears:
   - Workspace Path: an existing directory on the daemon machine (e.g. `/Users/you/project`)
   - Workspace ID: leave blank for auto-generated, or enter a custom ID
   - Click **New Session**

3. **Terminal** — xterm.js renders in the page. Type commands, see output streamed through relay.

## What it verifies

- WebSocket client connection to relay `/client/ws` with query-param auth.
- JSON-RPC passthrough: `open`, `terminal.start`, `terminal.subscribe`, `terminal.resize`.
- Binary frame passthrough: terminal stdin (`0x01`) and stdout (`0x02`).
- Terminal exit notification handling.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Connection error on connect | Relay not running, wrong URL, or token mismatch |
| `node is offline` | Daemon not connected to relay; check relay logs |
| `workspace not found` | Workspace path doesn't exist on daemon machine |
| No terminal output | `terminal.subscribe` may have failed; check browser console |
| `close 1005` | Browser closed WS unexpectedly; try serving page via HTTP instead of `file://` |
