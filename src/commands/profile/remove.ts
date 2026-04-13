/**
 * commands/profile/remove.ts — slock profile remove <name>
 *
 * Removes a stored profile locally. Unlike `auth logout`, this does NOT
 * call the server to invalidate the refresh token — it is purely a local
 * cleanup operation, intended for clearing stale or unwanted profile
 * entries (e.g. ones created against a dev server that's gone away).
 *
 * Use `auth logout --profile <name>` if you also want server-side token
 * revocation. Destructive on the local config; gated behind `--yes` per
 * the convention from `tasks/delete.ts` and `agents/delete.ts`.
 *
 * Refuses to remove the currently-active profile to prevent leaving the
 * config in a state where the active pointer is dangling. Switch with
 * `profile use <other>` first.
 */

import type { Command } from "commander";
import { getGlobalConfig, getProfile, deleteProfile } from "../../config.js";
import { success, fail } from "../../output.js";

export function registerProfileRemoveCommand(parent: Command): void {
  parent
    .command("remove <name>")
    .description("Remove a stored profile (local only; use `auth logout` to also revoke server-side)")
    .option("--yes", "Skip confirmation")
    .action((name: string, opts: { yes?: boolean }) => {
      // Destructive-action gate runs FIRST per `tasks/delete.ts` convention —
      // before any I/O, so a missing `--yes` reports INVALID_ARGS even if the
      // profile doesn't exist (which would otherwise mask the real issue).
      if (!opts.yes) {
        fail("INVALID_ARGS", `Pass --yes to confirm removal of profile "${name}".`);
      }
      const profile = getProfile(name);
      if (!profile) {
        fail("NOT_FOUND", `No profile "${name}" found.`);
      }
      const active = getGlobalConfig().activeProfile;
      if (name === active) {
        fail(
          "INVALID_ARGS",
          `Cannot remove the active profile "${name}". Switch with \`slock profile use <other>\` first.`
        );
      }
      deleteProfile(name);
      success(
        { removed: name },
        (d) => `Removed profile "${d.removed}"`
      );
    });
}
