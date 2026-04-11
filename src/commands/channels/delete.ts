/**
 * commands/channels/delete.ts — slock channels delete
 *
 * Destructive — follows the canonical `--yes` convention defined in
 * `commands/tasks/delete.ts`'s module header. The `--yes` gate runs FIRST,
 * before parseTarget / auth / resolution, so a missing `--yes` always
 * surfaces as `INVALID_ARGS` regardless of any other arg errors.
 *
 * The server soft-deletes via `deletedAt` (it does NOT hard-delete the
 * row). The built-in `#all` channel cannot be deleted — server returns
 * 403 with the message "The #all channel cannot be deleted", which the
 * CLI surfaces as `FORBIDDEN`.
 *
 * Auth: regular channels require server `manageChannels` capability
 * (admin/owner only); DM channels require participant. Non-admin users
 * get `FORBIDDEN`.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerChannelDeleteCommand(parent: Command): void {
  parent
    .command("delete")
    .description(
      "Soft-delete a channel (DESTRUCTIVE — requires --yes; admin only)"
    )
    .requiredOption(
      "--target <target>",
      "Channel target: #channel or dm:@peer"
    )
    .option(
      "--yes",
      "Confirm the destructive operation (required; no interactive prompt)"
    )
    .action(async (opts) => {
      if (!opts.yes) {
        fail(
          "INVALID_ARGS",
          "channels delete is destructive and requires --yes to confirm"
        );
      }

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

      await client.deleteChannel(channelId);

      success(
        { target: opts.target, channelId, deleted: true },
        (d) => `Deleted ${d.target}`
      );
    });
}
