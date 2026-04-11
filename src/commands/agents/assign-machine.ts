/**
 * commands/agents/assign-machine.ts — slock agents assign-machine
 *
 * Assigns or unassigns the machine an agent runs on. Capability-gated:
 * `manageAgents` (owner/admin only).
 *
 * The `--machine` flag accepts a machine UUID or name (resolved via
 * `resolveMachineId` in `src/resolvers.ts`). To unassign a machine
 * (leave the agent without a runner), pass `--machine null` — the
 * literal string `null` is converted to a JSON null on the wire.
 *
 * Server semantics:
 *   - Reassigning a running agent auto-stops it first (orchestrator
 *     handles the stop/restart transition).
 *   - Assignment alone does NOT auto-start the agent. Call
 *     `agents start` separately if you want it active on the new
 *     machine.
 *
 * Not destructive: machine assignment is fully reversible. No `--yes`
 * gate.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId, resolveMachineId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentAssignMachineCommand(parent: Command): void {
  parent
    .command("assign-machine")
    .description("Assign or unassign an agent's machine (requires manageAgents)")
    .requiredOption("--id <id>", "Agent UUID or name")
    .requiredOption(
      "--machine <id>",
      'Machine UUID or name, or literal "null" to unassign'
    )
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

      let machineId: string | null;
      if (opts.machine === "null") {
        machineId = null;
      } else {
        try {
          machineId = await resolveMachineId(client, opts.machine);
        } catch (err) {
          fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
        }
      }

      await client.assignAgentMachine(agentId, machineId);
      success(
        { agentId, machineId, assigned: machineId !== null },
        (d) =>
          d.machineId === null
            ? `Unassigned machine from agent ${d.agentId}`
            : `Assigned machine ${d.machineId} to agent ${d.agentId}`
      );
    });
}
