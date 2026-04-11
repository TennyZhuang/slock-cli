/**
 * commands/agents/list.ts — slock agents list
 *
 * Lists every agent on the active server. Read-only, ungated on the
 * server side (`GET /api/agents` requires only normal member auth);
 * `envVars` is server-side stripped for non-`manageAgents` callers,
 * so the JSON envelope's `envVars` field will be `null` for member
 * users on agents whose env was actually set.
 *
 * Output ordering follows the server's natural ordering (currently
 * createdAt ASC); the CLI doesn't re-sort.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerAgentListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all agents on the active server")
    .action(async () => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const agents = await client.listAgents();
      success({ agents }, (d) => {
        if (d.agents.length === 0) return "(no agents)";
        return d.agents
          .map((a) => {
            const display = a.displayName ?? a.name;
            const machine = a.machineId ? ` machine=${a.machineId}` : " (unassigned)";
            return `  ${a.id}  @${a.name}  "${display}"  [${a.runtime}/${a.model}]  ${a.status}/${a.activity}${machine}`;
          })
          .join("\n");
      });
    });
}
