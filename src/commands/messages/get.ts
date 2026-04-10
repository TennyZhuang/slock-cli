/**
 * commands/messages/get.ts — slock messages get
 *
 * Fetches a single message by id along with the surrounding context
 * window the server returns (hardcoded ±15 messages — there is no
 * server query parameter to widen this, so the CLI does not expose one).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";

export function registerGetCommand(parent: Command): void {
  parent
    .command("get")
    .description("Fetch a single message and its surrounding context (±15)")
    .requiredOption("--id <messageId>", "Message id (UUID)")
    .action(async (opts) => {
      const messageId = String(opts.id ?? "").trim();
      if (!messageId) {
        fail("INVALID_ARGS", "--id is required");
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const ctx = await client.getMessageContext(messageId);

      const target = ctx.messages.find((m) => m.id === ctx.targetMessageId);

      success(
        {
          channelId: ctx.channelId,
          targetMessageId: ctx.targetMessageId,
          hasOlder: ctx.hasOlder,
          hasNewer: ctx.hasNewer,
          messages: ctx.messages,
        },
        () => formatContext(ctx, target?.id)
      );
    });
}

function formatContext(
  ctx: {
    channelId: string;
    targetMessageId: string;
    hasOlder: boolean;
    hasNewer: boolean;
    messages: Array<{
      id: string;
      seq: number;
      senderName?: string;
      senderType: string;
      senderId: string;
      content: string;
    }>;
  },
  targetId: string | undefined
): string {
  if (ctx.messages.length === 0) return "(no messages)";
  const lines: string[] = [];
  if (ctx.hasOlder) lines.push("(... older messages above)");
  for (const m of ctx.messages) {
    const sender = m.senderName ?? `${m.senderType}:${m.senderId}`;
    const marker = m.id === targetId ? "▶ " : "  ";
    lines.push(`${marker}[${m.seq}] ${sender}: ${m.content}`);
  }
  if (ctx.hasNewer) lines.push("(... newer messages below)");
  return lines.join("\n");
}
