/**
 * commands/channels/leave.ts — slock channels leave
 *
 * Self-leave a channel. Not destructive (the channel still exists), so
 * no `--yes` flag — but the operation is one-way for non-admins, since
 * a member who leaves a private channel can only be re-added by an admin.
 *
 * Server rejects DM channels with 403 ("Cannot leave DM channels"); the
 * CLI surfaces this as `FORBIDDEN`. To "leave" a DM, use `channels delete`.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerChannelLeaveCommand(parent: Command): void {
  parent
    .command("leave")
    .description("Leave a channel (cannot leave DMs — use channels delete)")
    .requiredOption("--target <target>", "Channel target: #channel")
    .action(async (opts) => {
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

      await client.leaveChannel(channelId);

      success(
        { target: opts.target, channelId, left: true },
        (d) => `Left ${d.target}`
      );
    });
}
