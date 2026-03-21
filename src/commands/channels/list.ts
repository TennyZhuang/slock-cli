/**
 * commands/channels/list.ts — slock channels list
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerChannelListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all channels")
    .action(async () => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const channels = await client.listChannels();

      success(
        { channels },
        (d) =>
          d.channels.length === 0
            ? "(no channels)"
            : d.channels
                .map(
                  (c) =>
                    `${c.joined ? "*" : " "} #${c.name}${c.description ? ` — ${c.description}` : ""}`
                )
                .join("\n")
      );
    });
}
