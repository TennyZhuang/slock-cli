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
import { setActiveProfileOverride } from "./config.js";
import { registerLoginCommand } from "./commands/auth/login.js";
import { registerLogoutCommand } from "./commands/auth/logout.js";
import { registerStatusCommand } from "./commands/auth/status.js";
import { registerWhoamiCommand } from "./commands/auth/whoami.js";
import { registerSendCommand } from "./commands/messages/send.js";
import { registerReadCommand } from "./commands/messages/read.js";
import { registerWaitCommand } from "./commands/messages/wait.js";
import { registerGetCommand } from "./commands/messages/get.js";
import {
  registerSearchCommand,
  runSearch,
} from "./commands/messages/search.js";
import { registerChannelListCommand } from "./commands/channels/list.js";
import { registerChannelJoinCommand } from "./commands/channels/join.js";
import { registerChannelCreateCommand } from "./commands/channels/create.js";
import { registerChannelGetCommand } from "./commands/channels/get.js";
import { registerChannelDeleteCommand } from "./commands/channels/delete.js";
import { registerChannelLeaveCommand } from "./commands/channels/leave.js";
import { registerChannelReadCommand } from "./commands/channels/read.js";
import { registerChannelMembersListCommand } from "./commands/channels/members/list.js";
import { registerChannelMembersAddCommand } from "./commands/channels/members/add.js";
import { registerChannelMembersRemoveCommand } from "./commands/channels/members/remove.js";
import { registerServerInfoCommand } from "./commands/server/info.js";
import { registerTaskListCommand } from "./commands/tasks/list.js";
import { registerTaskCreateCommand } from "./commands/tasks/create.js";
import { registerTaskClaimCommand } from "./commands/tasks/claim.js";
import { registerTaskUnclaimCommand } from "./commands/tasks/unclaim.js";
import { registerTaskUpdateCommand } from "./commands/tasks/update.js";
import { registerTaskDeleteCommand } from "./commands/tasks/delete.js";
import { registerTaskConvertMessageCommand } from "./commands/tasks/convert-message.js";
import { registerUploadCommand } from "./commands/attachments/upload.js";
import { registerDownloadCommand } from "./commands/attachments/download.js";
import { registerMachineListCommand } from "./commands/machines/list.js";
import { registerMachineCreateCommand } from "./commands/machines/create.js";
import { registerMachineRotateKeyCommand } from "./commands/machines/rotate-key.js";
import { registerMachineRenameCommand } from "./commands/machines/rename.js";
import { registerMachineDeleteCommand } from "./commands/machines/delete.js";
import { registerThreadListCommand } from "./commands/threads/list.js";
import { registerThreadFollowCommand } from "./commands/threads/follow.js";
import { registerThreadUnfollowCommand } from "./commands/threads/unfollow.js";
import { registerThreadDoneCommand } from "./commands/threads/done.js";
import { registerThreadUndoneCommand } from "./commands/threads/undone.js";

const program = new Command();

program
  .name("slock")
  .description("CLI client for the Slock collaboration platform")
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
    // Propagate the global --profile flag to subcommands. Without this,
    // commander does not pass root-level options through, and any command
    // that doesn't redeclare its own --profile would silently fall back
    // to the default profile.
    if (typeof opts.profile === "string" && opts.profile.length > 0) {
      setActiveProfileOverride(opts.profile);
    }
  });

// ── auth ────────────────────────────────────────────────
const authCmd = program
  .command("auth")
  .description("Authentication commands");
registerLoginCommand(authCmd);
registerLogoutCommand(authCmd);
registerStatusCommand(authCmd);
registerWhoamiCommand(authCmd);

// ── messages ────────────────────────────────────────────
const messagesCmd = program
  .command("messages")
  .description("Message operations");
registerSendCommand(messagesCmd);
registerReadCommand(messagesCmd);
registerWaitCommand(messagesCmd);
registerGetCommand(messagesCmd);
registerSearchCommand(messagesCmd);

// ── search (top-level alias of `messages search`) ───────
// Positional query for ergonomics: `slock search "needle"`.
// All other flags pass through identically to `messages search`.
program
  .command("search <query>")
  .description("Search messages (alias of `messages search`)")
  .option(
    "--target <target>",
    "Scope to one channel/DM/thread: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid"
  )
  .option("--sender <senderId>", "Filter by sender id (user or agent UUID)")
  .option("--after <iso8601>", "Only messages on/after this timestamp")
  .option("--before <iso8601>", "Only messages on/before this timestamp")
  .option("--limit <n>", "Page size (server max 50, default 20)")
  .option("--offset <n>", "Pagination offset", "0")
  .action(async (query: string, opts) => {
    await runSearch({ ...opts, query });
  });

// ── channels ────────────────────────────────────────────
const channelsCmd = program
  .command("channels")
  .description("Channel operations");
registerChannelListCommand(channelsCmd);
registerChannelJoinCommand(channelsCmd);
registerChannelCreateCommand(channelsCmd);
registerChannelGetCommand(channelsCmd);
registerChannelDeleteCommand(channelsCmd);
registerChannelLeaveCommand(channelsCmd);
registerChannelReadCommand(channelsCmd);

// ── channels members (subcommand group) ─────────────────
const channelMembersCmd = channelsCmd
  .command("members")
  .description("Channel membership management");
registerChannelMembersListCommand(channelMembersCmd);
registerChannelMembersAddCommand(channelMembersCmd);
registerChannelMembersRemoveCommand(channelMembersCmd);

// ── tasks ───────────────────────────────────────────────
const tasksCmd = program
  .command("tasks")
  .description("Task board operations");
registerTaskListCommand(tasksCmd);
registerTaskCreateCommand(tasksCmd);
registerTaskClaimCommand(tasksCmd);
registerTaskUnclaimCommand(tasksCmd);
registerTaskUpdateCommand(tasksCmd);
registerTaskDeleteCommand(tasksCmd);
registerTaskConvertMessageCommand(tasksCmd);

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

// ── machines ────────────────────────────────────────────
const machinesCmd = program
  .command("machines")
  .description("Machine (compute node) management");
registerMachineListCommand(machinesCmd);
registerMachineCreateCommand(machinesCmd);
registerMachineRotateKeyCommand(machinesCmd);
registerMachineRenameCommand(machinesCmd);
registerMachineDeleteCommand(machinesCmd);

// ── threads ─────────────────────────────────────────────
const threadsCmd = program
  .command("threads")
  .description("Thread operations (follow/unfollow/done lifecycle)");
registerThreadListCommand(threadsCmd);
registerThreadFollowCommand(threadsCmd);
registerThreadUnfollowCommand(threadsCmd);
registerThreadDoneCommand(threadsCmd);
registerThreadUndoneCommand(threadsCmd);

program.parseAsync().catch((err) => {
  if (err instanceof CliExit) {
    process.exitCode = err.exitCode;
  } else {
    process.stderr.write(`Unexpected error: ${err?.message ?? err}\n`);
    process.exitCode = 1;
  }
});
