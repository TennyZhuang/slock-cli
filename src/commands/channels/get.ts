/**
 * commands/channels/get.ts — slock channels get
 *
 * Read-only metadata fetch for a single channel. Resolves the target via
 * the standard `--target` syntax (`#channel`, `dm:@peer`, `#channel:tid`)
 * before calling the server, so the JSON output includes both the original
 * target string and the resolved channel object.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerChannelGetCommand(parent: Command): void {
  parent
    .command("get")
    .description("Get metadata for a single channel")
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

      const channel = await client.getChannel(channelId);

      success(
        { target: opts.target, channel },
        (d) => {
          const c = d.channel;
          const lines: string[] = [];
          lines.push(`#${c.name}  [${c.type}]`);
          lines.push(`  id: ${c.id}`);
          if (c.description) lines.push(`  description: ${c.description}`);
          if (c.parentMessageId)
            lines.push(`  parentMessageId: ${c.parentMessageId}`);
          lines.push(`  createdAt: ${c.createdAt}`);
          if (c.deletedAt) lines.push(`  deletedAt: ${c.deletedAt}`);
          return lines.join("\n");
        }
      );
    });
}
