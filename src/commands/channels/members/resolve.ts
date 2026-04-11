/**
 * commands/channels/members/resolve.ts — shared agent/user lookup helpers
 *
 * The `--agent <id|name>` and `--user <id|name>` flags accept either a
 * UUID or a name. These helpers do the lookup against the active server's
 * agent list and member list respectively, normalizing both forms to a
 * concrete UUID before the request goes out.
 *
 * UUID detection is intentionally loose (a v4-shaped string passes) — if
 * the caller passed a UUID by accident the round-trip will fail with a
 * server-side validation error rather than a confusing "name not found".
 */

import type { ApiClient } from "../../../client.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Resolve an agent identifier (UUID or name) to a UUID. Throws on miss.
 */
export async function resolveAgentId(
  client: ApiClient,
  identifier: string
): Promise<string> {
  if (looksLikeUuid(identifier)) {
    return identifier;
  }
  const agents = await client.listAgents();
  const match = agents.find((a) => a.name === identifier);
  if (!match) {
    const known = agents.map((a) => a.name).join(", ") || "(none)";
    throw new Error(
      `Agent "${identifier}" not found in this server. Known agents: ${known}`
    );
  }
  return match.id;
}

/**
 * Resolve a user identifier (UUID or name) to a UUID. Throws on miss.
 *
 * NOTE: server's `listServerMembers` returns `userId` (not `id`) — see
 * `client.listServerMembers` JSDoc for the latent-bug history.
 */
export async function resolveUserId(
  client: ApiClient,
  identifier: string
): Promise<string> {
  if (looksLikeUuid(identifier)) {
    return identifier;
  }
  const members = await client.listServerMembers();
  const match = members.find((m) => m.name === identifier);
  if (!match) {
    const known = members.map((m) => m.name).join(", ") || "(none)";
    throw new Error(
      `User "${identifier}" not found in this server. Known members: ${known}`
    );
  }
  return match.userId;
}
