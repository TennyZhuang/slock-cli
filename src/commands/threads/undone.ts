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
import { parseThreadSpec, resolveThreadSpec } from "../../target.js";
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
      // Sync parse before auth — see `unfollow.ts` for the rationale.
      let spec;
      try {
        spec = parseThreadSpec(opts.thread);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let threadChannelId;
      try {
        threadChannelId = await resolveThreadSpec(client, spec);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      await client.markThreadUndone(threadChannelId);
      success(
        { threadChannelId },
        (d) => `Restored thread ${d.threadChannelId} to active list`
      );
    });
}
