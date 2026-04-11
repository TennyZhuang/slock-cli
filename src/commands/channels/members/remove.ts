/**
 * commands/channels/members/remove.ts — slock channels members remove
 *
 * Remove an agent or user from a channel. Mirrors `members add` —
 * `--agent` and `--user` are mutually exclusive, both accept UUID-or-name.
 *
 * Server splits removal into two distinct routes (`/members/agent/:id`
 * vs `/members/user/:id`), so the caller commits to the member type up
 * front. DM-specific quirk: removing a user from a DM is only permitted
 * if the caller is removing themselves (server returns 403 → CLI surfaces
 * as `FORBIDDEN`).
 *
 * Auth: regular channels require server `manageChannels` capability.
 *
 * Not flagged as destructive at the CLI layer (no `--yes` requirement)
 * because removal is fully reversible — the removed member can be
 * re-added with a single call. Compare with `channels delete` which is
 * irreversible from the CLI's perspective (soft-delete is server-only).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../../auth.js";
import { ApiClient } from "../../../client.js";
import { parseTarget, resolveTarget } from "../../../target.js";
import { success, fail } from "../../../output.js";
import { resolveAgentId, resolveUserId } from "./resolve.js";

export function registerChannelMembersRemoveCommand(parent: Command): void {
  parent
    .command("remove")
    .description("Remove an agent or user from a channel (admin only)")
    .requiredOption(
      "--target <target>",
      "Channel target: #channel or dm:@peer"
    )
    .option("--agent <id|name>", "Agent UUID or name to remove")
    .option("--user <id|name>", "User UUID or name to remove")
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

      let memberLabel: string;
      let removed: { agentId: string } | { userId: string };
      if (hasAgent) {
        const agentId = await resolveAgentId(client, opts.agent);
        await client.removeChannelAgent(channelId, agentId);
        removed = { agentId };
        memberLabel = `@${opts.agent}`;
      } else {
        const userId = await resolveUserId(client, opts.user);
        await client.removeChannelUser(channelId, userId);
        removed = { userId };
        memberLabel = opts.user;
      }

      success(
        { target: opts.target, channelId, removed },
        () => `Removed ${memberLabel} from ${opts.target}`
      );
    });
}
