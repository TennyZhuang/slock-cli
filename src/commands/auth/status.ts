/**
 * commands/auth/status.ts — slock auth status
 */

import type { Command } from "commander";
import {
  getGlobalConfig,
  getProfile,
  listProfiles,
} from "../../config.js";
import { isTokenExpired } from "../../auth.js";
import { success, fail } from "../../output.js";

export function registerStatusCommand(parent: Command): void {
  parent
    .command("status")
    .description("Show current auth status")
    .option("--profile <name>", "Profile to check")
    .action(async (opts) => {
      const globalConfig = getGlobalConfig();
      const profileName = opts.profile ?? globalConfig.activeProfile;
      const profile = getProfile(profileName);

      if (!profile) {
        fail("AUTH_FAILED", `Not logged in (profile "${profileName}" not found). Run \`slock auth login\`.`);
      }

      const tokenExpired = isTokenExpired(profile.accessToken);
      const profiles = listProfiles();

      success(
        {
          profile: profileName,
          active: profileName === globalConfig.activeProfile,
          serverUrl: profile.serverUrl,
          serverId: profile.serverId,
          userId: profile.userId,
          tokenStatus: tokenExpired ? "expired" : "valid",
          allProfiles: profiles,
        },
        (d) =>
          `Profile: ${d.profile}${d.active ? " (active)" : ""}\n` +
          `Server:  ${d.serverUrl}\n` +
          `User ID: ${d.userId}\n` +
          `Token:   ${d.tokenStatus}\n` +
          `All profiles: ${d.allProfiles.join(", ") || "(none)"}`
      );
    });
}
