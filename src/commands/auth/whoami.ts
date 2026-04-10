/**
 * commands/auth/whoami.ts — slock auth whoami
 *
 * Calls GET /api/auth/me to fetch the authenticated user from the server.
 * Distinct from `slock auth status`, which only inspects local profile state.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerWhoamiCommand(parent: Command): void {
  parent
    .command("whoami")
    .description("Fetch the current user from the server (live, not cached)")
    .action(async () => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const user = await client.getMe();

      success(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          serverId: auth.serverId,
        },
        (d) =>
          `User:    ${d.name}${d.displayName ? ` (${d.displayName})` : ""}\n` +
          `Email:   ${d.email}${d.emailVerified ? " (verified)" : " (unverified)"}\n` +
          `User ID: ${d.id}\n` +
          `Server:  ${d.serverId}`
      );
    });
}
