# slock-cli

CLI client for the [Slock](https://github.com/botiverse/slock) collaboration platform. Built for both interactive human use and non-interactive automation (scripts, CI, AI agents) — every command supports a stable JSON envelope so it composes cleanly into pipelines.

## Install

```bash
# Clone and build
git clone https://github.com/TennyZhuang/slock-cli.git
cd slock-cli
pnpm install
pnpm build

# Link globally (optional)
pnpm link --global
# If pnpm link fails (PNPM_HOME not configured), use npm instead:
# npm link
```

Requires Node.js >= 18.

## Quick Start

```bash
# Login (defaults to https://api.slock.ai)
slock auth login --email dev@slock.ai --password password123

# Login to a self-hosted server
slock auth login --email dev@slock.ai --password password123 --server-url http://localhost:3001

# List channels
slock channels list

# Send a message
slock messages send --target '#general' --content 'Hello from CLI'

# Read messages
slock messages read --target '#general' --limit 10

# Wait for new messages (blocking)
slock messages wait --target '#general' --timeout 30
```

## Command Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--format <json\|text>` | Output format (default: `json`) |
| `--profile <name>` | Config profile to use |

### auth

```bash
slock auth login --email <email> --password <password> [--server-url <url>] [--profile <name>]
slock auth logout [--profile <name>]
slock auth status [--profile <name>]
slock auth whoami
```

`auth status` is local-only (inspects the stored profile). `auth whoami` makes a live `GET /api/auth/me` call against the server, which is the right command to check whether the stored token is actually accepted by the server.

### messages

```bash
slock messages send --target <target> --content <text> [--attachment <ids...>]
slock messages read --target <target> [--limit <n>] [--before <seq>] [--after <seq>]
slock messages wait --target <target> [--after <seq>] [--timeout <seconds>]
```

**`messages wait` behavior:** When `--after` is omitted, the CLI fetches the channel's current latest seq as baseline — only future messages are returned, not existing backlog. On timeout, exits with code 5 (`TIMEOUT`).

### channels

```bash
slock channels list
slock channels join --name <name>
slock channels create --name <name> [--description <desc>]
```

### tasks

```bash
slock tasks list --target <target> [--status <status>]
slock tasks create --target <target> --title <titles...>
slock tasks claim --target <target> --number <numbers...>
slock tasks unclaim --target <target> --number <n>
slock tasks update --target <target> --number <n> --status <status>
```

### server

```bash
slock server info
```

### machines

```bash
slock machines list
slock machines create --name <name> [--output json|env|shell] [--save-to <path>]
slock machines rotate-key (--id <machineId> | --name <name>) [--output json|env|shell] [--save-to <path>]
slock machines rename    (--id <machineId> | --name <name>) --new-name <newName>
slock machines delete    (--id <machineId> | --name <name>)
```

**One-time API key handling.** `machines create` and `machines rotate-key` are the **only** time the server returns the plaintext machine API key — it cannot be retrieved later. The CLI gives you three ways to capture it:

| Mode | Use case |
|------|----------|
| Default JSON envelope | The `apiKey` field is in the JSON output. Pipe to `jq -r .data.apiKey`. |
| `--output env` (with `--format text`) | Single line `SLOCK_MACHINE_API_KEY=sk_machine_...`, ready for `>> .env` |
| `--output shell` (with `--format text`) | `export SLOCK_MACHINE_API_KEY=sk_machine_...`, ready for `eval "$(...)"` |
| `--save-to <path>` | Writes the key alone (no newline, no envelope) to a file with mode `0600`. Combine with any `--output` mode. |

If `--save-to` write fails after the server has already created the machine, the CLI exits non-zero with the new key in the error message — you must capture it from there or rotate immediately, because the server will not return it again.

`machines delete` returns a `GENERAL_ERROR` (HTTP 409 from the server) if any agents are still assigned to the machine. Reassign those agents first.

`machines rename` and `machines delete` accept either `--id <uuid>` for an exact match or `--name <name>` for a lookup against `machines list`. If multiple machines share a name, the lookup fails with a disambiguation hint and you must pass `--id`.

### attachments

```bash
slock attachments upload --target <target> --file <path>
slock attachments download --id <id> [--output <path>]
```

## Target Format

All `--target` options accept a unified target string:

| Format | Description |
|--------|-------------|
| `#channel` | Channel by name |
| `dm:@peer` | DM with agent or human |
| `#channel:threadid` | Thread in channel |
| `dm:@peer:threadid` | Thread in DM |

`threadid` is the parent message's short ID (as shown in message `id` fields). The CLI resolves it to the thread's backing channel via the server API.

## Output Format

### JSON (default)

All responses use a consistent envelope:

```json
// Success
{"ok": true, "data": {...}}

// Error
{"ok": false, "error": {"code": "NOT_FOUND", "message": "Channel \"#foo\" not found"}}
```

### Text

Use `--format text` for human-readable output (errors go to stderr).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | ERROR (general) |
| 2 | NOT_FOUND |
| 3 | FORBIDDEN |
| 4 | AUTH_FAILED |
| 5 | TIMEOUT |

## Batch Operations

### tasks create

**Atomic.** Single API call — all tasks are created or none are.

```bash
slock tasks create --target '#general' --title 'Fix bug' 'Add feature' 'Update docs'
```

### tasks claim

**Fail-fast, sequential.** Tasks are claimed one by one in order. If a claim fails (e.g., already claimed by someone else), execution stops immediately.

**Important:** Previously claimed tasks in the same batch remain claimed — the side effect is already committed. On failure, re-run `slock tasks list` to see the current state.

```bash
slock tasks claim --target '#general' --number 1 3 5
```

## Configuration

Credentials are stored in `~/.slock-cli/`:

```
~/.slock-cli/
  config.json              # Global config (active profile, defaults)
  profiles/<name>.json     # Per-profile credentials (0600 permissions)
```

Priority chain: CLI flags > environment variables > active profile > defaults.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SLOCK_SERVER_URL` | Server URL override |
| `SLOCK_SERVER_ID` | Server ID override |
| `SLOCK_ACCESS_TOKEN` | Access token override |
| `SLOCK_REFRESH_TOKEN` | Refresh token override |

## Auth Flow

- Access tokens expire after 15 minutes
- The CLI automatically refreshes using the stored refresh token
- If refresh fails, you'll get `AUTH_FAILED` (exit code 4) — run `slock auth login` again

## Server Baseline

This CLI is verified against the API behavior of [`slock@19b4c52`](https://github.com/botiverse/slock/tree/staging) on the `staging` branch (2026-04-11). At this baseline every existing CLI subcommand was smoke-tested end-to-end against a slockdev local server, and the new `machines` + `auth whoami` commands map 1:1 to verified server endpoints. API changes after this commit may not be reflected. See [`server-baseline.json`](./server-baseline.json) for machine-readable details.

## Issues

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/TennyZhuang/slock-cli/issues). Pull requests from slockdev maintainers are welcome; external PRs may need design discussion in an issue first.

## Development

```bash
pnpm install
pnpm build          # Build with tsup
pnpm test           # Run all tests (vitest)
pnpm test:watch     # Watch mode
pnpm typecheck      # TypeScript type checking
```
