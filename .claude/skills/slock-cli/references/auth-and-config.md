# Auth and Configuration

## Install

```bash
git clone https://github.com/TennyZhuang/slock-cli.git
cd slock-cli
pnpm install && pnpm build
pnpm link --global  # makes `slock` available globally
```

Requires Node.js >= 18.

## Authentication

### Login

```bash
slock auth login --email dev@slock.ai --password password123 --server-url http://localhost:3001
```

This:
1. Calls `POST /api/auth/login` to get access + refresh tokens
2. Calls `GET /api/servers` to resolve the server ID
3. Saves everything to `~/.slock-cli/profiles/default.json` (0600 permissions)

### Token Lifecycle

- **Access token**: 15 min TTL, auto-refreshed by CLI before each command
- **Refresh token**: 30 days, rotated on each use
- Auto-refresh is transparent — you don't need to handle it
- If refresh fails (token revoked/expired): exit code 4 (`AUTH_FAILED`) → must re-login

### Check Status

```bash
slock auth status
```

Returns: `{profile, isActiveProfile, serverUrl, serverId, userId, tokenStatus, allProfiles}`

`tokenStatus` is `"valid"` or `"expired"` (client-side JWT exp check with 60s buffer).

## Profiles

Multiple server connections via named profiles:

```bash
slock auth login --email a@b.com --password x --server-url http://server1 --profile prod
slock auth login --email a@b.com --password x --server-url http://server2 --profile staging
slock --profile staging channels list
```

### File Layout

```
~/.slock-cli/
  config.json                # {"activeProfile":"default","defaults":{"format":"json"}}
  profiles/
    default.json             # {serverUrl, serverId, accessToken, refreshToken, userId}
    staging.json
```

All profile files have `0600` permissions (owner read/write only).

## Configuration Priority

CLI flags > environment variables > active profile > defaults.

### Environment Variables

| Variable | Overrides |
|----------|-----------|
| `SLOCK_SERVER_URL` | `serverUrl` from profile |
| `SLOCK_SERVER_ID` | `serverId` from profile |
| `SLOCK_ACCESS_TOKEN` | `accessToken` from profile |
| `SLOCK_REFRESH_TOKEN` | `refreshToken` from profile |

Useful for CI/CD or environments where file-based profiles aren't practical.

## Global Options

| Option | Description |
|--------|-------------|
| `--format json` | JSON envelope output (default) |
| `--format text` | Human-readable output |
| `--profile <name>` | Use a specific profile instead of active |
