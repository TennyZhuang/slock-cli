/**
 * commands/messages/send.ts — slock messages send
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerSendCommand(parent: Command): void {
  parent
    .command("send")
    .description("Send a message")
    .requiredOption(
      "--target <target>",
      "Target: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid"
    )
    .requiredOption("--content <text>", "Message content")
    .option("--attachment <ids...>", "Attachment IDs to include")
    .action(async (opts) => {
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail(
          "INVALID_ARGS",
          err instanceof Error ? err.message : String(err)
        );
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
        fail(
          "NOT_FOUND",
          err instanceof Error ? err.message : String(err)
        );
      }

      const result = await client.sendMessage(
        channelId,
        opts.content,
        opts.attachment
      );

      success(
        {
          id: result.id,
          seq: result.seq,
          content: result.content,
          createdAt: result.createdAt,
        },
        (d) => `Message sent (seq=${d.seq})`
      );
    });
}
