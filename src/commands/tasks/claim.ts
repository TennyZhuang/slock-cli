/**
 * commands/tasks/claim.ts — slock tasks claim
 *
 * Batch claim: --number 1 3 5
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";
import { resolveTaskIds } from "./resolve.js";

export function registerTaskClaimCommand(parent: Command): void {
  parent
    .command("claim")
    .description("Claim tasks by number")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel"
    )
    .requiredOption(
      "--number <numbers...>",
      "Task number(s) — variadic, e.g.: --number 1 3 5"
    )
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

      const numbers = (opts.number as string[]).map((n) => parseInt(n, 10));
      const taskMap = await resolveTaskIds(client, channelId, numbers);

      const results: Array<{ taskNumber: number; id: string; status: string }> = [];

      for (const num of numbers) {
        const taskId = taskMap.get(num);
        if (!taskId) {
          fail("NOT_FOUND", `Task #t${num} not found in this channel`);
        }
        const result = await client.claimTask(taskId);
        results.push({
          taskNumber: num,
          id: result.task.id,
          status: result.task.status,
        });
      }

      success(
        { claimed: results },
        (d) =>
          d.claimed
            .map((t) => `Claimed #t${t.taskNumber}`)
            .join("\n")
      );
    });
}
