/**
 * commands/agents/stop.ts — slock agents stop
 *
 * Stops an agent's process. Capability-gated: `manageAgents`
 * (owner/admin only).
 *
 * Reversible (use `agents start` to restart with the same sessionId,
 * preserving full context). Stop is non-blocking on machine connection
 * failure: if the daemon is unreachable, the server still flips the
 * agent's status to `stopped` locally and cleans up the inbox. So
 * "stopped" reliably means "not running on the assigned machine"
 * even when the machine itself is offline.
 *
 * Not destructive: stopping an already-stopped agent is a no-op
 * server-side. No `--yes` gate.
 *
 * See `start.ts` for the asynchronous-status caveat — same applies
 * here in reverse.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentStopCommand(parent: Command): void {
  parent
    .command("stop")
    .description("Stop an agent's process (requires manageAgents)")
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

      await client.stopAgent(agentId);
      success(
        { agentId, stopped: true },
        (d) => `Stopped agent ${d.agentId}`
      );
    });
}
