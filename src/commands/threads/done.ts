/**
 * commands/threads/done.ts — slock threads done
 *
 * Mark a followed thread as "done" — hides it from the active
 * followed-list until a new reply arrives, at which point the server
 * auto-restores it. Useful for closing out a thread you've finished
 * reading without unfollowing it (so future replies still bring it
 * back).
 *
 * Reverse: `threads undone <thread>` — manually restores it without
 * waiting for a new reply. Both are reversible no-ops on the wrong
 * state, so neither needs a `--yes` gate.
 *
 * The `--thread` flag uses the same accept-UUID-or-target syntax as
 * `threads unfollow`; see `resolveThread` in `target.ts`.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveThread } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerThreadDoneCommand(parent: Command): void {
  parent
    .command("done")
    .description("Mark a followed thread as done (hide until next reply)")
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
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("Invalid thread") || msg.startsWith("Invalid target")) {
          fail("INVALID_ARGS", msg);
        }
        fail("NOT_FOUND", msg);
      }

      await client.markThreadDone(threadChannelId);
      success(
        { threadChannelId },
        (d) => `Marked thread ${d.threadChannelId} as done`
      );
    });
}
