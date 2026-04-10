/**
 * commands/machines/delete.ts — slock machines delete
 *
 * Deletes a machine. The server returns 409 (CONFLICT) if any agents
 * are still assigned to the machine; the caller must reassign them
 * first.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";
import { resolveMachineId } from "./resolve.js";

export function registerMachineDeleteCommand(parent: Command): void {
  parent
    .command("delete")
    .description("Delete a machine (fails if agents are still assigned)")
    .option("--id <machineId>", "Machine ID")
    .option("--name <name>", "Machine name (resolved against the machine list)")
    .action(async (opts) => {
      if (!opts.id && !opts.name) {
        fail("INVALID_ARGS", "Either --id or --name is required");
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const machineId = opts.id ?? (await resolveMachineId(client, opts.name));
      await client.deleteMachine(machineId);

      success(
        { machineId, deleted: true },
        (d) => `Deleted machine ${d.machineId}`
      );
    });
}
