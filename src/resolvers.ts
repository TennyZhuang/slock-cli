/**
 * resolvers.ts — entity ID/name resolution helpers.
 *
 * These helpers map a user-supplied `id-or-name` string to a server
 * UUID by querying the relevant `list*` endpoint. They exist because
 * several CLI commands accept either a UUID (for round-tripping
 * machine output) or a human-readable name (for hand-typed
 * invocation), and the server's mutation endpoints accept UUIDs only.
 *
 * Why a separate module from `target.ts`?
 *
 * `target.ts` is about the channel/DM/thread *addressing scheme* —
 * the parser for `#channel`, `dm:@peer`, `#channel:threadId` syntax.
 * These resolvers are about *individual entities* (an agent, a
 * machine) where the input is a flat identifier with no structural
 * syntax. Mixing the two would muddy `target.ts`'s scope.
 *
 * Both helpers are async-only by design (unlike `parseThreadSpec` /
 * `resolveThreadSpec` from PR-D, which split sync syntax checks from
 * async API resolution). The reason: there is no syntax to validate
 * here — any non-empty string is a candidate. The UUID short-circuit
 * is an optimization, not a parser. So the temporal-ordering
 * convention from PR-A/PR-D doesn't apply: callers run these helpers
 * after `ensureValidToken()` and the only failure mode is NOT_FOUND
 * (or AUTH_FAILED upstream from the auth check).
 */

import type { ApiClient } from "./client.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an agent identifier (UUID or name) to an agent UUID.
 *
 * - UUID input → returned as-is (no API call). This is the path that
 *   `agents list` JSON output → another `agents` command takes,
 *   matching the round-tripping property we established for threads
 *   in PR-D.
 * - Name input → fetches `listAgents()`, finds the agent whose
 *   `name` field equals the input, returns its `id`. Names are
 *   server-unique so the match is unambiguous.
 *
 * Throws on miss. Callers should map the thrown error to NOT_FOUND
 * (this matches the `resolveTarget` / `resolveThreadSpec` convention
 * — async resolution failures are NOT_FOUND, not INVALID_ARGS, since
 * the syntax was fine but the entity doesn't exist on this server).
 */
export async function resolveAgentId(
  client: ApiClient,
  raw: string
): Promise<string> {
  if (UUID_RE.test(raw)) {
    return raw;
  }
  const agents = await client.listAgents();
  const agent = agents.find((a) => a.name === raw);
  if (!agent) {
    throw new Error(`Agent "${raw}" not found`);
  }
  return agent.id;
}

/**
 * Resolve a machine identifier (UUID or name) to a machine UUID.
 *
 * Same shape as `resolveAgentId`. Used by `agents create --machine`
 * and `agents assign-machine --machine` to let users refer to
 * machines by name without having to look up the UUID first.
 *
 * Note that machine names are server-unique within a serverId, so
 * the match against `listMachines()` results is unambiguous.
 */
export async function resolveMachineId(
  client: ApiClient,
  raw: string
): Promise<string> {
  if (UUID_RE.test(raw)) {
    return raw;
  }
  const result = await client.listMachines();
  const machine = result.machines.find((m) => m.name === raw);
  if (!machine) {
    throw new Error(`Machine "${raw}" not found`);
  }
  return machine.id;
}
