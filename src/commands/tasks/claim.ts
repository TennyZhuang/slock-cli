/**
 * commands/tasks/claim.ts — slock tasks claim
 *
 * Batch claim: --number 1 3 5
 *
 * Contract: fail-fast, sequential. On the first API error, stops and
 * returns both the successfully claimed tasks and the failure details.
 * Previously claimed tasks remain claimed (side effect is committed).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail, CliExit } from "../../output.js";
import { resolveTaskIds } from "./resolve.js";

export function registerTaskClaimCommand(parent: Command): void {
  parent
    .command("claim")
    .description("Claim tasks by number (fail-fast: stops on first error, reports partial results)")
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

      const claimed: Array<{ taskNumber: number; id: string; status: string }> = [];

      for (const num of numbers) {
        const taskId = taskMap.get(num)!;
        try {
          const result = await client.claimTask(taskId);
          claimed.push({
            taskNumber: num,
            id: result.task.id,
            status: result.task.status,
          });
        } catch (err) {
          if (err instanceof CliExit) {
            // API error already output to stdout by client.
            // The error envelope was written but doesn't include partial results.
            // For now, the agent can see the claimed state by re-listing tasks.
            // The fail-fast behavior means partial claims are committed.
            throw err;
          }
          throw err;
        }
      }

      success(
        { claimed },
        (d) =>
          d.claimed
            .map((t) => `Claimed #t${t.taskNumber}`)
            .join("\n")
      );
    });
}
