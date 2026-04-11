/**
 * commands/channels/members/add.ts — slock channels members add
 *
 * Add an agent or a user to a channel. The two flags `--agent` and
 * `--user` are mutually exclusive — exactly one must be provided. Both
 * accept either a UUID or a name (resolved against `listAgents` /
 * `listServerMembers`).
 *
 * Auth: regular channels require server `manageChannels` capability;
 * DM channels require participant. Validation errors come back as 400
 * → `GENERAL_ERROR` with the server's message.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../../auth.js";
import { ApiClient } from "../../../client.js";
import { parseTarget, resolveTarget } from "../../../target.js";
import { success, fail } from "../../../output.js";
import { resolveAgentId, resolveUserId } from "./resolve.js";

export function registerChannelMembersAddCommand(parent: Command): void {
  parent
    .command("add")
    .description("Add an agent or user to a channel (admin only)")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel or dm:@peer"
    )
    .option("--agent <id|name>", "Agent UUID or name to add")
    .option("--user <id|name>", "User UUID or name to add")
    .action(async (opts) => {
      const hasAgent = typeof opts.agent === "string" && opts.agent.length > 0;
      const hasUser = typeof opts.user === "string" && opts.user.length > 0;
      if (hasAgent === hasUser) {
        fail(
          "INVALID_ARGS",
          "Exactly one of --agent or --user is required"
        );
      }

      let target;
      try {
        target = parseTarget(opts.target);
      } catch (err) {
        fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
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

      let payload: { agentId: string } | { userId: string };
      let memberLabel: string;
      if (hasAgent) {
        const agentId = await resolveAgentId(client, opts.agent);
        payload = { agentId };
        memberLabel = `@${opts.agent}`;
      } else {
        const userId = await resolveUserId(client, opts.user);
        payload = { userId };
        memberLabel = opts.user;
      }

      await client.addChannelMember(channelId, payload);

      success(
        {
          target: opts.target,
          channelId,
          added: payload,
        },
        () => `Added ${memberLabel} to ${opts.target}`
      );
    });
}
