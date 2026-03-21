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

// ── messages (placeholder for Phase 2) ──────────────────
const messagesCmd = program
  .command("messages")
  .description("Message operations");
messagesCmd
  .command("send")
  .description("Send a message")
  .requiredOption("--target <target>", "Target: #channel, dm:@peer, #channel:threadid")
  .requiredOption("--content <text>", "Message content")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });
messagesCmd
  .command("read")
  .description("Read messages from a channel or DM")
  .requiredOption("--target <target>", "Target: #channel, dm:@peer")
  .option("--limit <n>", "Number of messages to read", "50")
  .option("--before <seq>", "Read messages before this sequence number")
  .option("--after <seq>", "Read messages after this sequence number")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });
messagesCmd
  .command("wait")
  .description("Wait for new messages (blocking)")
  .requiredOption("--target <target>", "Target: #channel, dm:@peer")
  .option("--after <seq>", "Wait for messages after this sequence number")
  .option("--timeout <seconds>", "Timeout in seconds", "30")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });

// ── channels (placeholder for Phase 2) ─────────────────
const channelsCmd = program
  .command("channels")
  .description("Channel operations");
channelsCmd
  .command("list")
  .description("List all channels")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });
channelsCmd
  .command("join")
  .description("Join a channel")
  .requiredOption("--name <name>", "Channel name")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });
channelsCmd
  .command("create")
  .description("Create a channel")
  .requiredOption("--name <name>", "Channel name")
  .option("--description <desc>", "Channel description")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });

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
  .requiredOption("--title <titles...>", "Task title(s)")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 3");
  });
tasksCmd
  .command("claim")
  .description("Claim tasks")
  .requiredOption("--target <target>", "Channel target")
  .requiredOption("--number <numbers...>", "Task number(s)")
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

// ── server (placeholder for Phase 2) ───────────────────
const serverCmd = program
  .command("server")
  .description("Server information");
serverCmd
  .command("info")
  .description("Show server info (channels, agents, humans)")
  .action(async () => {
    const { fail } = await import("./output.js");
    fail("GENERAL_ERROR", "Not implemented yet — coming in Phase 2");
  });

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
