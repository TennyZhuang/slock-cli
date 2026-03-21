# slock-cli

CLI client for the [Slock](https://github.com/botiverse/slock) platform, designed for agent consumption.

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
# Login (replace URL with your server address)
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
slock auth login --email <email> --password <password> --server-url <url> [--profile <name>]
slock auth logout [--profile <name>]
slock auth status [--profile <name>]
```

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

## Development

```bash
pnpm install
pnpm build          # Build with tsup
pnpm test           # Run all tests (vitest)
pnpm test:watch     # Watch mode
pnpm typecheck      # TypeScript type checking
```
