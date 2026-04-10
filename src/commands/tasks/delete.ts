/**
 * commands/tasks/delete.ts — slock tasks delete
 *
 * ─── Canonical reference for slock-cli's destructive-command convention ───
 *
 * This file is the *first* destructive verb to land in slock-cli and
 * doubles as the convention reference for future destructive commands
 * (PR-C `channels delete`, PR-E `agents delete`, and any future verb
 * that mutates state irreversibly). All such commands MUST follow the
 * exact same shape so agents that have learned the pattern from one
 * command can apply it to every other one without re-reading help text.
 *
 * The contract (locked 2026-04-11 with @Stone, slock-cli msg `c7ac0fa3`):
 *
 *   1. **Requires `--yes` flag.** No interactive prompt. slock-cli has
 *      no TTY contract — its primary consumer is agent automation, and
 *      agents do not type at prompts. The flag is the confirmation.
 *
 *   2. **Refuses with `INVALID_ARGS`** (exit code 1) when `--yes` is
 *      missing. Error message MUST name the command being refused, in
 *      the exact form: `"<command> is destructive and requires --yes
 *      to confirm"`. Consistent phrasing lets calling agents pattern-
 *      match across commands.
 *
 *   3. **`--yes` gate runs FIRST**, before any other arg validation
 *      (target parsing, number parsing, auth). Rationale: when an
 *      agent calls a destructive verb without `--yes`, the *primary*
 *      diagnostic must be "did you mean to do this?" — not "your
 *      target syntax is also wrong" or "you're not logged in." Other
 *      errors are noise that distracts from the confirmation question.
 *      See Stone's PR-B verification matrix in msg `cb87851b` for the
 *      empirical demonstration.
 *
 *   4. **No `requires_confirmation` error code.** Agents detect
 *      destructive verbs by command name, not by retry-on-error.
 *      The "call without --yes → get specialized error → retry with
 *      --yes" pattern is solving a non-problem; the agent always
 *      knows up-front when it's calling a destructive verb because
 *      it just typed the verb. A custom error code would only add
 *      surface area to the CLI's error contract for no benefit.
 *
 * Prior art (universal Unix pattern this mirrors): `gh delete`,
 * `flyctl apps destroy --yes`, `kubectl delete --force`,
 * `terraform destroy -auto-approve`, `rm -i` / `rm -f`. Any agent
 * that has touched any of these CLIs will reach for `--yes` instinctively.
 *
 * ─── Endpoint-specific notes for `tasks delete` ───
 *
 * Wraps `DELETE /api/tasks/:taskId` (slock@staging `routes/tasks.ts:284`).
 * Auth on the server side requires either the original task creator OR
 * a server member with `manageServer` capability (admin/owner role);
 * other members get 403, which surfaces here as exit code `FORBIDDEN`.
 *
 * The CLI takes `--target #channel --number N` rather than a raw task
 * UUID because task numbers are the user-facing identifier (matching
 * `tasks list`/`claim`/`unclaim`/`update`). The number → UUID
 * resolution goes through `resolveTaskIds` (the same helper the rest
 * of the tasks/* commands use).
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
