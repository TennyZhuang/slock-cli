/**
 * commands/server/info.ts — slock server info
 *
 * Client-side aggregation of channels + agents + members.
 * Partial failure = whole-fail (no partial results).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerServerInfoCommand(parent: Command): void {
  parent
    .command("info")
    .description("Show server info (channels, agents, humans)")
    .action(async () => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      // Fetch all three in parallel — whole-fail on any error
      const [serverInfo, channels, agents, members] = await Promise.all([
        client.getServerInfo(),
        client.listChannels(),
        client.listAgents(),
        client.listServerMembers(),
      ]);

      success(
        {
          server: {
            id: serverInfo.id,
            name: serverInfo.name,
            slug: serverInfo.slug,
          },
          channels: channels.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            type: c.type,
            joined: c.joined,
          })),
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            displayName: a.displayName,
            status: a.status,
          })),
          members: members.map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role,
          })),
        },
        (d) => {
          const lines: string[] = [];
          lines.push(`Server: ${d.server.name} (${d.server.slug})`);
          lines.push("");
          lines.push(`Channels (${d.channels.length}):`);
          for (const c of d.channels) {
            lines.push(
              `  ${c.joined ? "*" : " "} #${c.name}${c.description ? ` — ${c.description}` : ""}`
            );
          }
          lines.push("");
          lines.push(`Agents (${d.agents.length}):`);
          for (const a of d.agents) {
            lines.push(
              `  @${a.name} [${a.status}]${a.displayName ? ` (${a.displayName})` : ""}`
            );
          }
          lines.push("");
          lines.push(`Members (${d.members.length}):`);
          for (const m of d.members) {
            lines.push(`  ${m.name} [${m.role}]`);
          }
          return lines.join("\n");
        }
      );
    });
}
