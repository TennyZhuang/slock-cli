/**
 * commands/channels/create.ts — slock channels create
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerChannelCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description("Create a channel")
    .requiredOption("--name <name>", "Channel name")
    .option("--description <desc>", "Channel description")
    .action(async (opts) => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const result = await client.createChannel(opts.name, opts.description);

      success(
        { channelId: result.id, name: result.name },
        (d) => `Created channel #${d.name}`
      );
    });
}
