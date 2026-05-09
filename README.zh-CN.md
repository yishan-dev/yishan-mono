<p align="center">
  <img src="apps/desktop/src/assets/images/yishan-transparent.png" alt="Yishan logo" width="100" height="100" />
</p>

<h1 align="center">Yishan</h1>

[English](README.md)

[![License](https://img.shields.io/badge/license-Elastic--2.0-blue.svg)](LICENSE)
[![PR Unit Tests](https://github.com/yishan-io/yishan-mono/actions/workflows/pr-unit-tests.yml/badge.svg)](https://github.com/yishan-io/yishan-mono/actions/workflows/pr-unit-tests.yml)
[![Desktop Release](https://github.com/yishan-io/yishan-mono/actions/workflows/desktop-release.yml/badge.svg)](https://github.com/yishan-io/yishan-mono/actions/workflows/desktop-release.yml)
[![GitHub stars](https://img.shields.io/github/stars/yishan-io/yishan-mono?style=social)](https://github.com/yishan-io/yishan-mono/stargazers)

让开发工作更轻松。

Yishan 帮助研发团队减少快速迭代中的运维与协作负担，例如任务切换、工作区上下文恢复、Agent 协同，以及项目状态管理。

## Yishan 是什么？

Yishan 是一个桌面工作区产品，由以下两部分组成：

- 本地 Go daemon 和 CLI，负责机器本地执行（文件系统、git、终端、Agent CLI 操作）。
- API service，负责账号和项目级数据（认证、组织、项目、节点、工作区、偏好设置）。

Yishan 的目标是让你在任务切换时不丢失节奏，尤其适用于需要恢复、交接或自动化的开发流程。

## 产品原则

- 降低任务、项目与工作区之间的上下文切换成本。
- 保留并共享有效上下文，让工作更快恢复和交接。
- 支持自带 Agent CLI，而不是强制单一运行时。
- 在需要本地访问时，让执行尽量靠近开发者机器。
- 仅在能显著减轻开发负担时引入新特性。

## 仓库结构

- `apps/desktop`: Electron + Vite 桌面端。
- `apps/cli`: Go CLI 与本地 daemon，提供工作区、文件、git、终端、Agent 操作的 WebSocket JSON-RPC API。
- `apps/api-service`: Hono API 服务。
- `apps/mobile` 与 `apps/web`: 移动端和 Web 端预留应用。
- `packages/design-tokens`: 共享设计令牌包。
- `packages/core` 与 `packages/runtime`: 跨应用共享包位。

## 环境要求

- Bun `1.3.3`（见根目录 `package.json` 的 `packageManager` 字段）。
- Go `1.24.x`。
- 用于 Electron/Vite 构建的 Node 兼容工具链。

安装工作区依赖：

```bash
bun install
```

## 快速开始

启动桌面应用：

```bash
bun --cwd apps/desktop run dev
```

启动 API 服务：

```bash
bun --cwd apps/api-service run dev:bun
```

从源码运行 CLI：

```bash
go run ./apps/cli
```

前台运行 daemon：

```bash
go run ./apps/cli daemon run --host 127.0.0.1 --port 0
```

构建包含嵌入式 CLI 二进制的桌面应用：

```bash
bun --cwd apps/desktop run build:app:dir
```

## 运行时模型

Yishan 将云端共享状态与本地执行分离：

- API service：管理账号、组织、项目、节点、工作区与偏好设置数据。
- 本地 daemon：在用户机器上执行文件系统、git、终端与 Agent CLI 操作。

daemon 端点：

- `/ws`: WebSocket JSON-RPC API。
- `/healthz`: 健康状态与 daemon 标识。

daemon 状态写入到 `~/.yishan/profiles/<profile>/daemon.state.json`。

## Agent 运行时安装

daemon 启动时会在 `~/.yishan` 下安装托管运行时文件：

- `~/.yishan/bin`: 支持的 Agent CLI 包装可执行文件。
- `~/.yishan/lib`: 共享包装辅助脚本。
- `~/.yishan/notify.sh` 与 `~/.yishan/notify.ps1`: Hook 通知桥接脚本。
- `~/.yishan/shell`: zsh/bash 启动包装，确保在托管终端会话中 `~/.yishan/bin` 位于 `PATH` 前部。
- `~/.yishan/opencode-config-home`: OpenCode 的托管配置目录。

已支持的 Agent：

- OpenCode
- Codex
- Claude
- Gemini
- Pi
- Copilot
- Cursor Agent

## 校验命令

运行 CLI 测试：

```bash
go test ./apps/cli/...
```

运行桌面端类型检查：

```bash
bun --cwd apps/desktop run check
```

运行 API 类型检查：

```bash
bun --cwd apps/api-service run check
```

## 配置

CLI 会读取 `YISHAN_` 前缀环境变量：

- `YISHAN_PROFILE`: 配置档名（默认：`default`）。
- `YISHAN_API_BASE_URL`: API 服务地址（默认：`https://api.yishan.io`）。
- `YISHAN_API_TOKEN`: API Bearer Token。
- `YISHAN_DAEMON_HOST`: daemon 主机（默认：`127.0.0.1`）。
- `YISHAN_DAEMON_PORT`: daemon 端口（默认：`0`，随机空闲端口）。
- `YISHAN_DAEMON_JWT_REQUIRED`: 是否要求 daemon WebSocket 鉴权（默认：`true`）。

CLI 命令和 daemon JSON-RPC 方法详见 `apps/cli/README.md`。

## 文档维护说明

- `README.md` 是仓库级行为和安装步骤的事实来源。
- `README.zh-CN.md` 保持与英文版相同的章节结构和命令示例。
- 修改任一 README 时，请在同一个 PR 中同步更新另一份对应章节。
