/**
 * commands/threads/unfollow.ts — slock threads unfollow
 *
 * Stop following a thread. Reverse of `threads follow`. Idempotent on
 * the server side (unfollowing a thread you don't follow is a no-op).
 *
 * The `--thread` flag accepts either a raw thread channel UUID (the
 * shape `threads list` emits) or an explicit thread target like
 * `#channel:parentShortId` / `dm:@peer:parentShortId` for users who
 * know the parent message but not the thread UUID. See `resolveThread`
 * in `target.ts` for the full parsing rules.
 *
 * Not destructive: the only state lost is the user's *follow* row,
 * which can be recreated with `threads follow --message-id <uuid>`.
 * No `--yes` gate; convention reserves that for irreversible actions
 * (see `tasks/delete.ts` for the canonical convention reference).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveThread } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerThreadUnfollowCommand(parent: Command): void {
  parent
    .command("unfollow")
    .description("Stop following a thread")
    .requiredOption(
      "--thread <id>",
      "Thread channel UUID, or #channel:parentShortId / dm:@peer:parentShortId"
    )
    .action(async (opts) => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let threadChannelId;
      try {
        threadChannelId = await resolveThread(client, opts.thread);
      } catch (err) {
        // resolveThread throws on invalid syntax (handled like INVALID_ARGS
        // since the user-supplied --thread didn't parse) OR on a missing
        // channel/thread (NOT_FOUND once we hit the API). We can't
        // distinguish without inspecting the message, but the syntax
        // errors all start with "Invalid thread"/"Invalid target" which
        // is the parser-level signal — anything else is a resolution
        // failure from the API path.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("Invalid thread") || msg.startsWith("Invalid target")) {
          fail("INVALID_ARGS", msg);
        }
        fail("NOT_FOUND", msg);
      }

      await client.unfollowThread(threadChannelId);
      success(
        { threadChannelId },
        (d) => `Unfollowed thread ${d.threadChannelId}`
      );
    });
}
