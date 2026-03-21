/**
 * commands/tasks/update.ts — slock tasks update
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";
import { resolveTaskIds } from "./resolve.js";

const VALID_STATUSES = ["todo", "in_progress", "in_review", "done"];

export function registerTaskUpdateCommand(parent: Command): void {
  parent
    .command("update")
    .description("Update task status")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel"
    )
    .requiredOption("--number <n>", "Task number")
    .requiredOption(
      "--status <status>",
      "New status: todo, in_progress, in_review, done"
    )
    .action(async (opts) => {
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      if (!VALID_STATUSES.includes(opts.status)) {
        fail(
          "INVALID_ARGS",
          `Invalid status "${opts.status}". Must be one of: ${VALID_STATUSES.join(", ")}`
        );
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

      const number = parseInt(opts.number, 10);
      const taskMap = await resolveTaskIds(client, channelId, [number]);
      const taskId = taskMap.get(number)!;

      const result = await client.updateTaskStatus(taskId, opts.status);

      success(
        {
          taskNumber: number,
          id: result.task.id,
          status: result.task.status,
        },
        (d) => `#t${d.taskNumber} → ${d.status}`
      );
    });
}
