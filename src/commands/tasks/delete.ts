/**
 * commands/tasks/delete.ts — slock tasks delete
 *
 * Destructive: requires explicit `--yes` confirmation (no interactive
 * prompt — the CLI is non-interactive by default for agent automation).
 * Server returns 403 if the caller is neither the task creator nor a
 * server admin/owner; that surfaces as a `FORBIDDEN` exit code.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";
import { resolveTaskIds } from "./resolve.js";

export function registerTaskDeleteCommand(parent: Command): void {
  parent
    .command("delete")
    .description(
      "Delete a task from the channel (DESTRUCTIVE — requires --yes)"
    )
    .requiredOption("--target <target>", "Channel target: #channel")
    .requiredOption("--number <n>", "Task number to delete")
    .option(
      "--yes",
      "Confirm the destructive operation (required; no interactive prompt)"
    )
    .action(async (opts) => {
      if (!opts.yes) {
        fail(
          "INVALID_ARGS",
          "tasks delete is destructive and requires --yes to confirm"
        );
      }

      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      const number = parseInt(opts.number, 10);
      if (!Number.isFinite(number) || number <= 0) {
        fail("INVALID_ARGS", `--number must be a positive integer, got "${opts.number}"`);
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

      const taskMap = await resolveTaskIds(client, channelId, [number]);
      const taskId = taskMap.get(number)!;

      await client.deleteTask(taskId);

      success(
        { taskNumber: number, taskId, deleted: true },
        (d) => `Deleted #t${d.taskNumber}`
      );
    });
}
