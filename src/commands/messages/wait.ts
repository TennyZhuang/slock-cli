/**
 * commands/messages/wait.ts — slock messages wait
 *
 * Blocking poll for new messages using sync endpoint.
 * Polls at intervals until new messages arrive or timeout.
 *
 * Timeout: exit code 5, {ok:false, error:{code:"TIMEOUT", message:...}}
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

const POLL_INTERVAL_MS = 1000;

export function registerWaitCommand(parent: Command): void {
  parent
    .command("wait")
    .description("Wait for new messages (blocking)")
    .requiredOption(
      "--target <target>",
      "Target: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid"
    )
    .option("--after <seq>", "Wait for messages after this sequence number")
    .option("--timeout <seconds>", "Timeout in seconds", "30")
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

      const timeoutSec = parseInt(opts.timeout, 10);
      const sinceSeq = opts.after ? parseInt(opts.after, 10) : await getLatestSeq(client, channelId);
      const deadline = Date.now() + timeoutSec * 1000;

      while (Date.now() < deadline) {
        const messages = await client.syncMessages(sinceSeq, channelId);

        if (messages.length > 0) {
          const latestSeq = Math.max(...messages.map((m) => m.seq));
          const oldestSeq = Math.min(...messages.map((m) => m.seq));

          success(
            { messages, latestSeq, oldestSeq },
            (d) =>
              d.messages
                .map((m) => {
                  const sender = m.senderName ?? `${m.senderType}:${m.senderId}`;
                  return `[${m.seq}] ${sender}: ${m.content}`;
                })
                .join("\n")
          );
        }

        // Sleep before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      // Timeout reached
      fail("TIMEOUT", `No new messages within ${timeoutSec}s`);
    });
}

/**
 * Get the latest seq for a channel to establish the baseline for waiting.
 * Reads 1 message to get the current latest seq.
 */
async function getLatestSeq(client: ApiClient, channelId: string): Promise<number> {
  const result = await client.listMessages(channelId, { limit: 1 });
  if (result.messages.length > 0) {
    return result.messages[0].seq;
  }
  return 0;
}
