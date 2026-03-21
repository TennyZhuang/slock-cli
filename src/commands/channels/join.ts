/**
 * commands/channels/join.ts — slock channels join
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";

export function registerChannelJoinCommand(parent: Command): void {
  parent
    .command("join")
    .description("Join a channel")
    .requiredOption("--name <name>", "Channel name")
    .action(async (opts) => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const channels = await client.listChannels();
      const channel = channels.find((c) => c.name === opts.name);
      if (!channel) {
        fail("NOT_FOUND", `Channel "#${opts.name}" not found`);
      }

      if (channel.joined) {
        success(
          { channelId: channel.id, name: channel.name, alreadyJoined: true },
          () => `Already a member of #${channel.name}`
        );
      }

      await client.joinChannel(channel.id);

      success(
        { channelId: channel.id, name: channel.name, alreadyJoined: false },
        () => `Joined #${channel.name}`
      );
    });
}
