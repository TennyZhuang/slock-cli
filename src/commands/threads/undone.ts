/**
 * commands/threads/undone.ts — slock threads undone
 *
 * Reverse of `threads done` — manually restore a thread to the active
 * followed-list without waiting for a new reply to auto-restore it.
 * See `done.ts` for the full design rationale.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveThread } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerThreadUndoneCommand(parent: Command): void {
  parent
    .command("undone")
    .description("Restore a done thread to the active followed-list")
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

      await client.markThreadUndone(threadChannelId);
      success(
        { threadChannelId },
        (d) => `Restored thread ${d.threadChannelId} to active list`
      );
    });
}
