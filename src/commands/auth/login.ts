/**
 * commands/auth/login.ts — slock auth login
 */

import type { Command } from "commander";
import { login } from "../../auth.js";
import {
  getGlobalConfig,
  saveGlobalConfig,
  resolveConfig,
  getActiveProfileOverride,
} from "../../config.js";
import { success, fail } from "../../output.js";

const DEFAULT_SERVER_URL = "https://api.slock.ai";

export function registerLoginCommand(parent: Command): void {
  parent
    .command("login")
    .description("Login to a Slock server")
    .requiredOption("--email <email>", "Account email")
    .requiredOption("--password <password>", "Account password")
    .option("--server-url <url>", `Slock server URL (default: ${DEFAULT_SERVER_URL})`)
    .option("--profile <name>", "Profile name to save credentials to")
    .action(async (opts) => {
      const profileName =
        opts.profile ??
        getActiveProfileOverride() ??
        getGlobalConfig().activeProfile;

      // Resolve server URL: CLI flag → env var → active profile → default hosted
      const serverUrl =
        opts.serverUrl ??
        resolveConfig({ profile: profileName }).serverUrl ??
        DEFAULT_SERVER_URL;

      let result;
      try {
        result = await login(
          serverUrl,
          opts.email,
          opts.password,
          profileName
        );
      } catch (err) {
        // Catch network errors (fetch failures, connection refused, etc.)
        const msg = err instanceof Error ? err.message : String(err);
        fail(
          "NETWORK_ERROR",
          `Cannot connect to ${serverUrl}: ${msg}`
        );
      }

      // Set as active profile
      const config = getGlobalConfig();
      config.activeProfile = profileName;
      saveGlobalConfig(config);

      success(
        {
          user: result.user,
          serverId: result.serverId,
          profile: profileName,
        },
        (d) =>
          `Logged in as ${d.user.name} (${d.user.email})\n` +
          `Server: ${d.serverId}\n` +
          `Profile: ${d.profile}`
      );
    });
}
