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

      const { agents, humans } = await client.getChannelMembers(channelId);

      // Server returns two parallel arrays; we surface them separately
      // in JSON (callers can pattern-match on agent vs. human without a
      // string type tag) and merge them in the text formatter for the
      // typical "who's in this channel" rendering.
      success(
        { target: opts.target, channelId, agents, humans },
        (d) => {
          const total = d.agents.length + d.humans.length;
          if (total === 0) return "(no members)";
          return [
            ...d.agents.map((a) => `  @${a.name} [agent]`),
            ...d.humans.map((h) => `  ${h.name} [human]`),
          ].join("\n");
        }
      );
    });
}
