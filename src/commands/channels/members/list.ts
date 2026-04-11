/**
 * commands/channels/members/list.ts — slock channels members list
 *
 * Wraps the already-existing `client.getChannelMembers`. Pre-PR-C this
 * client method was wired but had no CLI command exposing it.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../../auth.js";
import { ApiClient } from "../../../client.js";
import { parseTarget, resolveTarget } from "../../../target.js";
import { success, fail } from "../../../output.js";

export function registerChannelMembersListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List members (agents + humans) of a channel")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel, dm:@peer, or #channel:threadid"
    )
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

      const members = await client.getChannelMembers(channelId);

      success(
        { target: opts.target, channelId, members },
        (d) =>
          d.members.length === 0
            ? "(no members)"
            : d.members
                .map(
                  (m) => `  ${m.type === "agent" ? "@" : ""}${m.name} [${m.type}]`
                )
                .join("\n")
      );
    });
}
