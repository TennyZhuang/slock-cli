/**
 * commands/profile/current.ts — slock profile current
 *
 * Prints the currently-active profile name. Distinct from `auth status`
 * which also validates token freshness and hits server-derived fields —
 * `current` is the cheap "which profile am I in?" lookup with no I/O
 * beyond reading config.json.
 */

import type { Command } from "commander";
import { getGlobalConfig, getProfile } from "../../config.js";
import { success, fail } from "../../output.js";

export function registerProfileCurrentCommand(parent: Command): void {
  parent
    .command("current")
    .description("Show the currently active profile name")
    .action(() => {
      const name = getGlobalConfig().activeProfile;
      const profile = getProfile(name);
      if (!profile) {
        // Active profile points at a non-existent file. `profile remove`
        // refuses to delete the active one, so this state realistically
        // arises from `auth logout --profile <active>` or manual edits to
        // ~/.slock-cli/. Surface explicitly so users don't get a confusing
        // AUTH_FAILED later.
        fail(
          "NOT_FOUND",
          `Active profile "${name}" has no stored credentials. Run \`slock auth login --profile ${name}\` or \`slock profile use <other>\`.`
        );
      }
      success(
        {
          name,
          serverUrl: profile.serverUrl,
          serverId: profile.serverId,
          userId: profile.userId,
        },
        (d) => `${d.name}\t${d.serverUrl}`
      );
    });
}
