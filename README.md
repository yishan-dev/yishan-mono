# ![Yishan logo](apps/desktop/src/assets/images/yishan-transparent.png) Yishan

[简体中文](README.zh-CN.md)

[![License](https://img.shields.io/badge/license-Elastic--2.0-blue.svg)](LICENSE)
[![PR Unit Tests](https://github.com/yishan-io/yishan-mono/actions/workflows/pr-unit-tests.yml/badge.svg)](https://github.com/yishan-io/yishan-mono/actions/workflows/pr-unit-tests.yml)
[![Desktop Release](https://github.com/yishan-io/yishan-mono/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/yishan-io/yishan-mono/actions/workflows/desktop-release.yml)
[![GitHub stars](https://img.shields.io/github/stars/yishan-io/yishan-mono?style=social)](https://github.com/yishan-io/yishan-mono/stargazers)

Make development work feel lighter.

Yishan helps development teams reduce the operational overhead that builds up in fast software cycles: switching tasks, restoring workspace context, coordinating agent work, and keeping project state close at hand.

## What is Yishan?

Yishan is a desktop workspace product backed by:

- A local Go daemon and CLI for machine-local execution (filesystem, git, terminal, and agent CLI operations).
- An API service for account and project-level data (auth, organizations, projects, nodes, workspaces, and preferences).

The product is designed to make it easier to move between tasks without losing momentum, especially when work needs to be resumed, handed off, or automated.

## Product Principles

- Reduce context switching between tasks, projects, and workspaces.
- Preserve and share useful development context so work can be resumed or handed off faster.
- Support bring-your-own-agent CLI workflows instead of forcing one runtime.
- Keep execution close to the developer machine when local access is required.
- Add new features only when they make development cycles lighter and faster.

## Repository Layout

- `apps/desktop`: Electron + Vite desktop client.
- `apps/cli`: Go CLI and local daemon with WebSocket JSON-RPC APIs for workspace, file, git, terminal, and agent operations.
- `apps/api-service`: Hono API service.
- `apps/mobile` and `apps/web`: mobile/web app surfaces.
- `packages/design-tokens`: shared design token package.
- `packages/core` and `packages/runtime`: shared cross-app package slots.

## Requirements

- Bun `1.3.3` (see root `package.json` `packageManager` field).
- Go `1.24.x`.
- Node-compatible tooling for Electron/Vite builds.

Install workspace dependencies:

```bash
bun install
```

## Quick Start

Start the desktop app:

```bash
bun --cwd apps/desktop run dev
```

Start the API service:

```bash
bun --cwd apps/api-service run dev:bun
```

Run the CLI from source:

```bash
go run ./apps/cli
```

Run the daemon in the foreground:

```bash
go run ./apps/cli daemon run --host 127.0.0.1 --port 0
```

Build the desktop app with an embedded CLI binary:

```bash
bun --cwd apps/desktop run build:app:dir
```

## Runtime Model

Yishan separates cloud-shared state from local execution:

- API service: account, organization, project, node, workspace, and preference data.
- Local daemon: filesystem, git, terminal, and agent CLI execution on the user's machine.

Daemon endpoints:

- `/ws`: WebSocket JSON-RPC API.
- `/healthz`: health and daemon identity.

Daemon state is written to `~/.yishan/profiles/<profile>/daemon.state.json`.

## Agent Runtime Setup

On daemon startup, managed runtime files are installed under `~/.yishan`:

- `~/.yishan/bin`: wrapper executables for supported agent CLIs.
- `~/.yishan/lib`: shared wrapper helper scripts.
- `~/.yishan/notify.sh` and `~/.yishan/notify.ps1`: hook notification bridges.
- `~/.yishan/shell`: zsh/bash startup wrappers that keep `~/.yishan/bin` first in `PATH` for managed sessions.
- `~/.yishan/opencode-config-home`: managed OpenCode config home.

Supported agents:

- OpenCode
- Codex
- Claude
- Gemini
- Pi
- Copilot
- Cursor Agent

## Validation Checks

Run CLI tests:

```bash
go test ./apps/cli/...
```

Run desktop type checks:

```bash
bun --cwd apps/desktop run check
```

Run API type checks:

```bash
bun --cwd apps/api-service run check
```

## Configuration

The CLI reads `YISHAN_`-prefixed environment variables:

- `YISHAN_PROFILE`: profile name (default: `default`).
- `YISHAN_API_BASE_URL`: API service URL (default: `https://api.yishan.io`).
- `YISHAN_API_TOKEN`: API bearer token.
- `YISHAN_DAEMON_HOST`: daemon host (default: `127.0.0.1`).
- `YISHAN_DAEMON_PORT`: daemon port (default: `0`, random free port).
- `YISHAN_DAEMON_JWT_REQUIRED`: whether daemon WebSocket auth is required (default: `true`).

For detailed CLI commands and daemon JSON-RPC methods, see `apps/cli/README.md`.

## Documentation Maintenance

- Keep `README.md` as the source of truth for repository-level behavior and setup.
- Keep `README.zh-CN.md` aligned with the same section structure and command examples.
- When editing one README, update the corresponding section in the other in the same pull request.
