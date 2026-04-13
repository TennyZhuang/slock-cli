/**
 * commands/profile/use.ts — slock profile use <name>
 *
 * Switches the active profile by writing `activeProfile` in config.json.
 * Pure local — does not refresh tokens or contact the server. Subsequent
 * commands without explicit `--profile` will resolve to this profile.
 *
 * Refuses to switch to a profile that has no stored credentials, to avoid
 * leaving the user in a broken state where every subsequent command fails
 * with AUTH_FAILED. Use `slock auth login --profile <name>` to create one.
 */

import type { Command } from "commander";
import { getGlobalConfig, getProfile, saveGlobalConfig } from "../../config.js";
import { success, fail } from "../../output.js";

export function registerProfileUseCommand(parent: Command): void {
  parent
    .command("use <name>")
    .description("Switch the active profile")
    .action((name: string) => {
      const profile = getProfile(name);
      if (!profile) {
        fail(
          "NOT_FOUND",
          `No profile "${name}" found. Run \`slock auth login --profile ${name}\` first.`
        );
      }
      const config = getGlobalConfig();
      const previous = config.activeProfile;
      config.activeProfile = name;
      saveGlobalConfig(config);
      success(
        { activeProfile: name, previousProfile: previous },
        (d) =>
          d.previousProfile === d.activeProfile
            ? `Already on profile "${d.activeProfile}"`
            : `Switched active profile: ${d.previousProfile} → ${d.activeProfile}`
      );
    });
}
