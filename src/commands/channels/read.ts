/**
 * commands/channels/read.ts — slock channels read
 *
 * Mark a channel as read. Two modes:
 *   - With `--seq <N>`: marks read up to that specific seq (server's
 *     `POST /api/channels/:id/read` endpoint, body `{seq}`).
 *   - Without `--seq`: marks the channel fully read at whatever seq is
 *     latest at the time of the call (server's `POST /api/channels/:id/read-all`
 *     endpoint, returns `{ok: true, seq}`).
 *
 * The two endpoints are surfaced as one command rather than two because
 * the agent ergonomic is "I'm done processing this channel" — the
 * fully-read path is the common case, and `--seq` is the precision opt-in.
 * Naming a separate `read-all` subcommand would be confusing because the
 * server endpoint is per-channel "fully read", not "all channels read".
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerChannelReadCommand(parent: Command): void {
  parent
    .command("read")
    .description(
      "Mark a channel as read (default: fully read at latest seq)"
    )
    .requiredOption(
      "--target <target>",
      "Channel target: #channel, dm:@peer, or #channel:threadid"
    )
    .option(
      "--seq <n>",
      "Mark read up to this specific seq (default: latest)"
    )
    .action(async (opts) => {
      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
      }

      let seqOverride: number | undefined;
      if (opts.seq !== undefined) {
        const parsed = Number(opts.seq);
        if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
          fail(
            "INVALID_ARGS",
            `--seq must be a positive integer, got "${opts.seq}"`
          );
        }
        seqOverride = parsed;
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

      let markedSeq: number | undefined;
      if (seqOverride !== undefined) {
        await client.markChannelRead(channelId, seqOverride);
        markedSeq = seqOverride;
      } else {
        const result = await client.markChannelReadAll(channelId);
        markedSeq = result.seq;
      }

      success(
        {
          target: opts.target,
          channelId,
          seq: markedSeq,
          mode: seqOverride !== undefined ? "seq" : "all",
        },
        (d) => `Marked ${d.target} read up to seq=${d.seq}`
      );
    });
}
