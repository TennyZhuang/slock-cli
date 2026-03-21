/**
 * index.ts — CLI entry point.
 *
 * Wires together all commands under a resource-based structure:
 *   slock auth login/logout/status
 *   slock messages send/read/wait
 *   slock channels list/join/create
 *   slock tasks list/create/claim/unclaim/update
 *   slock server info
 *   slock attachments upload/download
 */

import { Command } from "commander";
import { setOutputFormat, CliExit } from "./output.js";
import { registerLoginCommand } from "./commands/auth/login.js";
import { registerLogoutCommand } from "./commands/auth/logout.js";
import { registerStatusCommand } from "./commands/auth/status.js";
import { registerSendCommand } from "./commands/messages/send.js";
import { registerReadCommand } from "./commands/messages/read.js";
import { registerWaitCommand } from "./commands/messages/wait.js";
import { registerChannelListCommand } from "./commands/channels/list.js";
import { registerChannelJoinCommand } from "./commands/channels/join.js";
import { registerChannelCreateCommand } from "./commands/channels/create.js";
import { registerServerInfoCommand } from "./commands/server/info.js";
import { registerTaskListCommand } from "./commands/tasks/list.js";
import { registerTaskCreateCommand } from "./commands/tasks/create.js";
import { registerTaskClaimCommand } from "./commands/tasks/claim.js";
import { registerTaskUnclaimCommand } from "./commands/tasks/unclaim.js";
import { registerTaskUpdateCommand } from "./commands/tasks/update.js";
import { registerUploadCommand } from "./commands/attachments/upload.js";
import { registerDownloadCommand } from "./commands/attachments/download.js";

const program = new Command();

program
  .name("slock")
  .description("CLI client for Slock platform (designed for agent usage)")
  .version("0.1.0")
  .option("--format <format>", "Output format: json (default) or text", "json")
  .option("--profile <name>", "Config profile to use")
  .enablePositionalOptions()
  .passThroughOptions()
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.format === "text" || opts.format === "json") {
      setOutputFormat(opts.format);
    }
  });

// ── auth ────────────────────────────────────────────────
const authCmd = program
  .command("auth")
  .description("Authentication commands");
registerLoginCommand(authCmd);
registerLogoutCommand(authCmd);
registerStatusCommand(authCmd);

// ── messages ────────────────────────────────────────────
const messagesCmd = program
  .command("messages")
  .description("Message operations");
registerSendCommand(messagesCmd);
registerReadCommand(messagesCmd);
registerWaitCommand(messagesCmd);

// ── channels ────────────────────────────────────────────
const channelsCmd = program
  .command("channels")
  .description("Channel operations");
registerChannelListCommand(channelsCmd);
registerChannelJoinCommand(channelsCmd);
registerChannelCreateCommand(channelsCmd);

// ── tasks ───────────────────────────────────────────────
const tasksCmd = program
  .command("tasks")
  .description("Task board operations");
registerTaskListCommand(tasksCmd);
registerTaskCreateCommand(tasksCmd);
registerTaskClaimCommand(tasksCmd);
registerTaskUnclaimCommand(tasksCmd);
registerTaskUpdateCommand(tasksCmd);

// ── server ──────────────────────────────────────────────
const serverCmd = program
  .command("server")
  .description("Server information");
registerServerInfoCommand(serverCmd);

// ── attachments ─────────────────────────────────────────
const attachmentsCmd = program
  .command("attachments")
  .description("Attachment operations");
registerUploadCommand(attachmentsCmd);
registerDownloadCommand(attachmentsCmd);

program.parseAsync().catch((err) => {
  if (err instanceof CliExit) {
    process.exitCode = err.exitCode;
  } else {
    process.stderr.write(`Unexpected error: ${err?.message ?? err}\n`);
    process.exitCode = 1;
  }
});
