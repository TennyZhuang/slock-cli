/**
 * commands/agents/activity-log.ts — slock agents activity-log
 *
 * Fetches the durable activity log for an agent, including tool
 * invocations, starts/ends, and outputs. Entries are returned in
 * reverse-chronological order (newest first).
 *
 * The `--id` flag accepts either a raw UUID or an agent name. Name
 * resolution goes through `resolveAgentId` in `src/resolvers.ts`.
 *
 * Usage: slock agents activity-log --id <uuid-or-name> [--limit 50]
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

export function registerAgentActivityLogCommand(parent: Command): void {
  parent
    .command("activity-log")
    .description("Fetch the durable activity log for an agent")
    .requiredOption("--id <id>", "Agent UUID or name")
    .option(
      "--limit <n>",
      "Number of entries to return (default 50)",
      "50"
    )
    .action(async (opts) => {
      const limit = parseInt(opts.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        fail("INVALID_ARGS", "--limit must be a positive integer");
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

      const log = await client.getAgentActivityLog(agentId, limit);
      success({ agentId, limit, entries: log }, (d) => {
        if (d.entries.length === 0) return "(no activity log entries)";
        return d.entries
          .map((e) => {
            const time = new Date(e.timestamp).toISOString();
            const kind = e.entry.kind ?? "(unknown)";
            const tool = e.entry.toolName ? ` ${e.entry.toolName}` : "";
            const input = e.entry.toolInput
              ? ` input=${e.entry.toolInput}`
              : "";
            const output = e.entry.toolOutput
              ? ` output=${e.entry.toolOutput}`
              : "";
            return `  ${time}  ${kind}${tool}${input}${output}`;
          })
          .join("\n");
      });
    });
}