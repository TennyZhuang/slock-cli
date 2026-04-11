/**
 * commands/agents/delete.ts — slock agents delete
 *
 * Soft-deletes an agent (sets `deletedAt`, cascades DM channel
 * cleanup, attempts to stop the agent first if running).
 * Capability-gated: `manageAgents` (owner/admin only).
 *
 * Follows the destructive-command convention (canonical reference:
 * `src/commands/tasks/delete.ts`):
 *   1. Requires `--yes`. No interactive prompt.
 *   2. `--yes` gate runs FIRST, before any other validation/auth.
 *      The `--yes` refusal is the only error the user should see when
 *      they call a destructive verb forgetfully.
 *   3. Refuses with INVALID_ARGS (exit 1), error message names the
 *      command being refused.
 *
 * The `--id` flag accepts UUID or name (resolved via
 * `resolveAgentId`); name resolution happens after `--yes` and after
 * auth, since it's an API call.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentDeleteCommand(parent: Command): void {
  parent
    .command("delete")
    .description("Delete an agent (DESTRUCTIVE — requires --yes)")
    .requiredOption("--id <id>", "Agent UUID or name")
    .option(
      "--yes",
      "Confirm the destructive operation (required; no interactive prompt)"
    )
    .action(async (opts) => {
      if (!opts.yes) {
        fail(
          "INVALID_ARGS",
          "agents delete is destructive and requires --yes to confirm"
        );
      }

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

      await client.deleteAgent(agentId);
      success(
        { agentId, deleted: true },
        (d) => `Deleted agent ${d.agentId}`
      );
    });
}
