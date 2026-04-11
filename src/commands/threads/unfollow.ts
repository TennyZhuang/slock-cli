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
import { parseThreadSpec, resolveThreadSpec } from "../../target.js";
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
      // Sync parse runs BEFORE auth so a malformed --thread reports
      // INVALID_ARGS regardless of login state — same temporal-ordering
      // convention as `messages send` / `messages search`. The async
      // resolve runs after auth (it needs the API client) and its
      // errors map to NOT_FOUND. The structural split makes
      // INVALID_ARGS-vs-NOT_FOUND a function-boundary distinction
      // instead of a brittle error-message prefix match.
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

      await client.unfollowThread(threadChannelId);
      success(
        { threadChannelId },
        (d) => `Unfollowed thread ${d.threadChannelId}`
      );
    });
}
