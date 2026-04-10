/**
 * commands/machines/rename.ts — slock machines rename
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";
import { resolveMachineId } from "./resolve.js";

export function registerMachineRenameCommand(parent: Command): void {
  parent
    .command("rename")
    .description("Rename a machine")
    .option("--id <machineId>", "Machine ID")
    .option("--name <name>", "Current machine name (used to look up the ID)")
    .requiredOption("--new-name <newName>", "New machine name")
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
      const updated = await client.renameMachine(machineId, opts.newName);

      // Server currently returns the raw machine row including the argon2
      // apiKeyHash. Project to a safe allow-list before surfacing to the
      // caller — we never want to echo hashes (or any other secret-derived
      // material) into agent stdout.
      const safeMachine = {
        id: updated.id,
        name: updated.name,
        serverId: updated.serverId,
      };

      success(
        { machine: safeMachine },
        (d) => `Renamed machine ${d.machine.id} → ${d.machine.name}`
      );
    });
}
