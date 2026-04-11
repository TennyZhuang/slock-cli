/**
 * commands/agents/start.ts — slock agents start
 *
 * Starts an agent's process on its assigned machine. Capability-gated:
 * `manageAgents` (owner/admin only).
 *
 * Server preconditions:
 *   - Agent must have a `machineId` assigned. Server returns 400
 *     "Machine not assigned" if not — surfaces as GENERAL_ERROR here.
 *   - Machine must be online. Server returns 400 "Machine offline.
 *     Please start your local daemon." if not.
 *
 * Asynchronous behavior: the start request returns `{ok: true}` once
 * the server has issued the spawn command to the daemon, but the
 * agent's `status` field doesn't immediately flip to `active` — that
 * happens via separate Socket.io broadcast once the Claude CLI
 * subprocess actually starts. Callers who need to confirm the agent
 * is up should poll `agents get` or watch for the activity broadcast.
 * The CLI does NOT poll automatically — that would couple it to a
 * timeout policy that's hard to get right for every use case.
 *
 * Not destructive: starting an already-active agent is a no-op
 * server-side. No `--yes` gate.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentStartCommand(parent: Command): void {
  parent
    .command("start")
    .description("Start an agent's process (requires manageAgents)")
    .requiredOption("--id <id>", "Agent UUID or name")
    .action(async (opts) => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let agentId;
      try {
        agentId = await resolveAgentId(client, opts.id);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      await client.startAgent(agentId);
      success(
        { agentId, started: true },
        (d) =>
          `Started agent ${d.agentId} (status will reflect via broadcast — poll \`agents get\` to confirm)`
      );
    });
}
