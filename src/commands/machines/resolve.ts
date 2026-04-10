/**
 * commands/machines/resolve.ts — shared machine name → ID lookup
 */

import type { ApiClient } from "../../client.js";
import { fail } from "../../output.js";

/**
 * Resolve a machine name to its ID by listing machines on the current
 * server. Fails with NOT_FOUND if no match, or GENERAL_ERROR if multiple
 * machines share the name (caller should pass --id to disambiguate).
 */
export async function resolveMachineId(
  client: ApiClient,
  name: string
): Promise<string> {
  const result = await client.listMachines();
  const matches = result.machines.filter((m) => m.name === name);

  if (matches.length === 0) {
    fail("NOT_FOUND", `Machine "${name}" not found in this server`);
  }
  if (matches.length > 1) {
    const ids = matches.map((m) => m.id).join(", ");
    fail(
      "GENERAL_ERROR",
      `Multiple machines named "${name}" exist (ids: ${ids}). Pass --id to disambiguate.`
    );
  }
  return matches[0].id;
}
