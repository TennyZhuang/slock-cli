/**
 * commands/tasks/unclaim.ts — slock tasks unclaim
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";
import { resolveTaskIds } from "./resolve.js";

export function registerTaskUnclaimCommand(parent: Command): void {
  parent
    .command("unclaim")
    .description("Release your claim on a task")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel"
    )
    .requiredOption("--number <n>", "Task number")
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

      const number = parseInt(opts.number, 10);
      const taskMap = await resolveTaskIds(client, channelId, [number]);
      const taskId = taskMap.get(number)!;

      const result = await client.unclaimTask(taskId);

      success(
        { taskNumber: number, id: result.task.id, status: result.task.status },
        () => `Released #t${number}`
      );
    });
}
