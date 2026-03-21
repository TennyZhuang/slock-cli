/**
 * commands/messages/read.ts — slock messages read
 *
 * Reads messages from a channel/DM/thread.
 * Enriches response with latestSeq/oldestSeq from message array
 * for agent incremental polling.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

export function registerReadCommand(parent: Command): void {
  parent
    .command("read")
    .description("Read messages from a channel or DM")
    .requiredOption(
      "--target <target>",
      "Target: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid"
    )
    .option("--limit <n>", "Number of messages to read", "50")
    .option("--before <seq>", "Read messages before this sequence number")
    .option("--after <seq>", "Read messages after this sequence number (uses sync endpoint)")
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

      const limit = parseInt(opts.limit, 10);

      if (opts.after) {
        // Use sync endpoint for --after (incremental read)
        const sinceSeq = parseInt(opts.after, 10);
        const messages = await client.syncMessages(sinceSeq, channelId, limit);

        const latestSeq =
          messages.length > 0
            ? Math.max(...messages.map((m) => m.seq))
            : null;
        const oldestSeq =
          messages.length > 0
            ? Math.min(...messages.map((m) => m.seq))
            : null;

        success(
          { messages, latestSeq, oldestSeq },
          (d) => formatMessages(d.messages)
        );
      } else {
        // Use list endpoint for regular read (optionally with --before)
        const before = opts.before ? parseInt(opts.before, 10) : undefined;
        const result = await client.listMessages(channelId, { limit, before });

        const latestSeq =
          result.messages.length > 0
            ? Math.max(...result.messages.map((m) => m.seq))
            : null;
        const oldestSeq =
          result.messages.length > 0
            ? Math.min(...result.messages.map((m) => m.seq))
            : null;

        success(
          {
            messages: result.messages,
            historyLimited: result.historyLimited ?? false,
            latestSeq,
            oldestSeq,
          },
          (d) => formatMessages(d.messages)
        );
      }
    });
}

function formatMessages(
  messages: Array<{
    seq: number;
    senderName?: string;
    senderType: string;
    senderId: string;
    content: string;
    createdAt: string;
  }>
): string {
  if (messages.length === 0) return "(no messages)";
  return messages
    .map((m) => {
      const sender = m.senderName ?? `${m.senderType}:${m.senderId}`;
      return `[${m.seq}] ${sender}: ${m.content}`;
    })
    .join("\n");
}
