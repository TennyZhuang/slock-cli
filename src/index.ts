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

// ── tasks (placeholder for Phase 3) ────────────────────
const tasksCmd = program
  .command("tasks")
  .description("Task board operations");
tasksCmd
  .command("list")
  .description("List tasks")
  .requiredOption("--target <target>", "Channel target")
  .option("--status <status>", "Filter by status")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });
tasksCmd
  .command("create")
  .description("Create tasks")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--title <titles...>", "Task title(s) — variadic, e.g.: --title 'Fix bug' 'Add feature'")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });
tasksCmd
  .command("claim")
  .description("Claim tasks")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--number <numbers...>", "Task number(s) — variadic, e.g.: --number 1 3 5")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });
tasksCmd
  .command("unclaim")
  .description("Unclaim a task")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--number <n>", "Task number")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });
tasksCmd
  .command("update")
  .description("Update task status")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--number <n>", "Task number")
  .requiredOption("--status <status>", "New status: todo, in_progress, in_review, done")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });

// ── server ──────────────────────────────────────────────
const serverCmd = program
  .command("server")
  .description("Server information");
registerServerInfoCommand(serverCmd);

// ── attachments (placeholder for Phase 4) ──────────────
const attachmentsCmd = program
  .command("attachments")
  .description("Attachment operations");
attachmentsCmd
  .command("upload")
  .description("Upload an image file")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--file <path>", "File path")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 4");
  });
attachmentsCmd
  .command("download")
  .description("Download an attachment")
  .requiredOption("--id <id>", "Attachment ID")
  .option("--output <path>", "Output file path")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 4");
  });

program.parseAsync().catch((err) => {
  if (err instanceof CliExit) {
    process.exitCode = err.exitCode;
  } else {
    process.stderr.write(`Unexpected error: ${err?.message ?? err}\n`);
    process.exitCode = 1;
  }
});
