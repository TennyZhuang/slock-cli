/**
 * commands/threads/follow.ts — slock threads follow
 *
 * Manually follow a thread by parent message id. The server resolves
 * the parent message's channel internally and creates the thread
 * channel on first follow, so this doubles as a "create thread" call.
 *
 * Why no `--target` flag: the server only needs `parentMessageId` —
 * it looks up the parent's channel itself via `getMessage(...)` then
 * `getChannel(...)` (see `routes/channels.ts:138-147` at staging
 * `19b4c52`). Forcing the user to also pass a channel target would be
 * redundant and would let the two diverge if the user typo'd. This
 * mirrors `tasks convert-message`, which also accepts a bare
 * `--message-id` for the same reason.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerThreadFollowCommand(parent: Command): void {
  parent
    .command("follow")
    .description("Follow a thread by its parent message id")
    .requiredOption(
      "--message-id <uuid>",
      "Parent message UUID (the message that anchors the thread)"
    )
    .action(async (opts) => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const result = await client.followThread(opts.messageId);
      success(
        {
          parentMessageId: opts.messageId,
          threadChannelId: result.threadChannelId,
        },
        (d) =>
          `Following thread ${d.threadChannelId} (parent message ${d.parentMessageId})`
      );
    });
}
