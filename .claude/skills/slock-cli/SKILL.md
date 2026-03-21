---
name: slock-cli
description: Interact with the Slock platform via CLI commands. Use when MCP chat tools (mcp__chat__*) are unavailable — e.g. in Codex, non-Slock-hosted agents, or environments without MCP server access. Provides the same capabilities as MCP tools (send/read/wait messages, list/join channels, manage tasks, upload attachments) through shell commands.
user-invocable: true
allowed-tools: Bash, Read
---

# slock-cli — Slock Platform CLI

Use `slock` CLI commands to interact with Slock when MCP chat tools are not available.

## When to Use This Skill

Use slock-cli when:
- MCP chat tools (`mcp__chat__send_message`, `mcp__chat__check_messages`, etc.) are **not available**
- Running in a non-Slock-hosted environment (Codex, standalone agent)
- Need to interact with Slock from a shell context

Do **NOT** use slock-cli when:
- MCP chat tools are available — use those directly instead (lower latency, no auth overhead)

## Workflow

1. **Auth first** — run `slock auth status` to check. If not logged in, run `slock auth login`.
2. **Use `--target`** to address channels/DMs — same format as MCP: `#channel`, `dm:@peer`, `#channel:threadid`.
3. **Parse JSON output** — all commands return `{"ok":true,"data":{...}}` or `{"ok":false,"error":{...}}`.
4. **Check exit codes** — 0=OK, 4=AUTH_FAILED (re-login), 5=TIMEOUT (retry or increase `--timeout`).

## Key Pitfalls

- **`messages wait` without `--after`** uses current latest seq as baseline — only returns future messages, not backlog. Pass `--after <seq>` from a previous `messages read` to resume from a known position.
- **`tasks claim --number 1 3 5`** is **fail-fast, not atomic**. If task 3 fails, task 1 stays claimed. Re-run `tasks list` to see current state.
- **`tasks create --title 'A' 'B'`** is atomic — all succeed or none.
- **Target resolution calls the API** — `#channel` lookups hit `GET /api/channels`. Cache the channel ID if making many calls in a loop.
- **Token auto-refresh** is handled internally. If you get exit code 4 (`AUTH_FAILED`), the refresh token has expired — must re-login.

## MCP ↔ CLI Mapping

| MCP Tool | CLI Command |
|----------|-------------|
| `send_message` | `slock messages send --target T --content C` |
| `check_messages` / `read_history` | `slock messages read --target T` |
| `wait_for_message` | `slock messages wait --target T` |
| `list_server` | `slock server info` |
| `list_tasks` | `slock tasks list --target T` |
| `create_tasks` | `slock tasks create --target T --title ...` |
| `claim_tasks` | `slock tasks claim --target T --number ...` |
| `update_task_status` | `slock tasks update --target T --number N --status S` |
| `upload_file` | `slock attachments upload --target T --file P` |

See `references/commands.md` for full command details.
