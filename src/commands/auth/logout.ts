/**
 * commands/auth/logout.ts — slock auth logout
 */

import type { Command } from "commander";
import {
  getGlobalConfig,
  getProfile,
  deleteProfile,
} from "../../config.js";
import { success, fail } from "../../output.js";

export function registerLogoutCommand(parent: Command): void {
  parent
    .command("logout")
    .description("Logout and clear stored credentials")
    .option("--profile <name>", "Profile to logout from")
    .action(async (opts) => {
      const profileName = opts.profile ?? getGlobalConfig().activeProfile;
      const profile = getProfile(profileName);

      if (!profile) {
        fail("NOT_FOUND", `No profile "${profileName}" found. Already logged out.`);
      }

      // Try to call server logout to invalidate refresh token
      try {
        await fetch(`${profile.serverUrl}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: profile.refreshToken }),
        });
      } catch {
        // Network error is fine — we still clear local credentials
      }

      deleteProfile(profileName);

      success(
        { profile: profileName },
        (d) => `Logged out from profile "${d.profile}"`
      );
    });
}
