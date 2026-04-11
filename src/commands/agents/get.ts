/**
 * commands/agents/get.ts — slock agents get
 *
 * Fetch a single agent by UUID or name. Read-only and ungated on the
 * server (members can read agent metadata; `envVars` is stripped for
 * non-`manageAgents` callers).
 *
 * The `--id` flag accepts either a raw UUID or an agent name. Name
 * resolution goes through `resolveAgentId` in `src/resolvers.ts`,
 * which lists all agents and matches `name` exactly. Names are
 * server-unique so the match is unambiguous.
 *
 * Why no sync `parseAgentSpec` like `parseThreadSpec` from PR-D?
 * Because there's no syntax to validate — any non-empty string is a
 * valid candidate (UUIDs short-circuit as an optimization, names go
 * through the API). The temporal-ordering convention (sync parse
 * before auth) doesn't apply: the only failure mode is "agent not
 * found" which legitimately requires the API call. See `resolvers.ts`
 * JSDoc for the design rationale.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentGetCommand(parent: Command): void {
  parent
    .command("get")
    .description("Get a single agent by UUID or name")
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

      const agent = await client.getAgent(agentId);
      success(agent, (d) => {
        const lines = [
          `id:              ${d.id}`,
          `name:            @${d.name}`,
          `displayName:     ${d.displayName ?? "(none)"}`,
          `description:     ${d.description ?? "(none)"}`,
          `runtime/model:   ${d.runtime}/${d.model}`,
          `reasoningEffort: ${d.reasoningEffort ?? "(default)"}`,
          `status:          ${d.status}`,
          `activity:        ${d.activity} — ${d.activityDetail}`,
          `machineId:       ${d.machineId ?? "(unassigned)"}`,
          `sessionId:       ${d.sessionId ?? "(none)"}`,
          `created:         ${d.createdAt}`,
        ];
        return lines.join("\n");
      });
    });
}
