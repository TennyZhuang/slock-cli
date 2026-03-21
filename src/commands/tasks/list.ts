/**
 * commands/tasks/list.ts — slock tasks list
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerTaskListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List tasks on a channel's task board")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel"
    )
    .option("--status <status>", "Filter by status: todo, in_progress, in_review, done")
    .action(async (opts) => {
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let channelId;
      try {
        channelId = await resolveTarget(client, target);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      const result = await client.listTasks(channelId, opts.status);

      success(
        { tasks: result.tasks },
        (d) => {
          if (d.tasks.length === 0) return "(no tasks)";
          return d.tasks
            .map((t) => {
              const assignee = t.claimedByName ? ` → ${t.claimedByName}` : "";
              return `#t${t.taskNumber} [${t.status}] ${t.title}${assignee}`;
            })
            .join("\n");
        }
      );
    });
}
