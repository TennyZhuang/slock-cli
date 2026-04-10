/**
 * commands/tasks/convert-message.ts — slock tasks convert-message
 *
 * Promote an existing chat message to a task. The server resolves the
 * message's channel internally, so no `--target` is required. Thread
 * messages are rejected by the server (409); the CLI surfaces this as
 * `GENERAL_ERROR` with the server's reason.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";

export function registerTaskConvertMessageCommand(parent: Command): void {
  parent
    .command("convert-message")
    .description("Promote an existing message to a task")
    .requiredOption("--message-id <uuid>", "ID of the message to convert")
    .action(async (opts) => {
      const messageId = String(opts.messageId ?? "").trim();
      if (!messageId) {
        fail("INVALID_ARGS", "--message-id is required");
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const result = await client.convertMessageToTask(messageId);
      const t = result.task;

      success(
        {
          taskNumber: t.taskNumber,
          id: t.id,
          messageId: t.messageId,
          channelId: t.channelId,
          status: t.status,
          title: t.title,
          createdByName: t.createdByName,
        },
        (d) => `Converted message → #t${d.taskNumber} "${d.title}" (${d.status})`
      );
    });
}
