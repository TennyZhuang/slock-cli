/**
 * commands/threads/list.ts — slock threads list
 *
 * Two modes in one command:
 *   - No flags        → followed mode (the user's followed-thread inbox)
 *   - --target <ch>   → in-channel mode (every thread under a channel)
 *
 * Why one command and not two? The two modes return *different shapes*
 * (an array of rich rows vs. a parentMessageId → summary map), but both
 * answer the same question — "what threads exist for this scope?" — and
 * the scope is naturally expressed by whether `--target` is passed.
 * Splitting into `threads list` and `threads list-in <ch>` would force
 * users to remember a second verb for what is conceptually a filter on
 * the same listing. The shape divergence is preserved in the JSON
 * envelope (followed → `{threads: [...]}`, in-channel → `{threads: {...}}`)
 * so callers can disambiguate by inspecting the `data.threads` type.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerThreadListCommand(parent: Command): void {
  parent
    .command("list")
    .description(
      "List followed threads, or all threads in a channel with --target"
    )
    .option(
      "--target <target>",
      "Scope to one channel: #channel or dm:@peer (omit for followed-thread inbox)"
    )
    .action(async (opts) => {
      // No --target → followed mode (no parsing needed)
      if (!opts.target) {
        const auth = await ensureValidToken();
        const client = new ApiClient({
          serverUrl: auth.serverUrl,
          serverId: auth.serverId,
          accessToken: auth.accessToken,
        });
        const result = await client.listFollowedThreads();
        success(result, (d) => {
          if (d.threads.length === 0) return "(no followed threads)";
          return d.threads
            .map((t) => {
              const tag =
                t.parentChannelType === "dm"
                  ? `dm:${t.parentChannelName}`
                  : `#${t.parentChannelName}`;
              const unread = t.unreadCount > 0 ? ` (${t.unreadCount} unread)` : "";
              const task =
                t.taskNumber !== null
                  ? ` [task #${t.taskNumber} ${t.taskStatus}]`
                  : "";
              return `${tag}${unread}${task} — ${t.parentMessagePreview}`;
            })
            .join("\n");
        });
      }

      // --target → in-channel mode. parseTarget runs before auth so a
      // malformed target reports INVALID_ARGS regardless of auth state,
      // matching the convention from messages send / messages search.
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }
      if (target.threadId) {
        fail(
          "INVALID_ARGS",
          `--target for "threads list" must be a channel, not a thread (got "${opts.target}")`
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
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      const summaries = await client.listChannelThreads(channelId);
      success(
        { channelId, threads: summaries },
        (d) => {
          const entries = Object.entries(d.threads);
          if (entries.length === 0) return "(no threads in channel)";
          return entries
            .map(
              ([parentId, info]) =>
                `${parentId} → ${info.threadChannelId} (${info.replyCount} replies, ${info.participantIds.length} participants)`
            )
            .join("\n");
        }
      );
    });
}
