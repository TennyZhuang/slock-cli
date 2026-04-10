/**
 * commands/machines/list.ts — slock machines list
 *
 * Lists all machines registered to the current server.
 * Includes daemon version + per-machine status.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success } from "../../output.js";

export function registerMachineListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List machines registered to the current server")
    .action(async () => {
      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const result = await client.listMachines();

      success(
        {
          machines: result.machines.map((m) => ({
            id: m.id,
            name: m.name,
            status: m.status,
            lastHeartbeat: m.lastHeartbeat,
            daemonVersion: m.daemonVersion ?? null,
          })),
          latestDaemonVersion: result.latestDaemonVersion,
        },
        (d) => {
          if (d.machines.length === 0) return "(no machines registered)";
          const lines: string[] = [];
          lines.push(`Latest daemon version: ${d.latestDaemonVersion ?? "unknown"}`);
          lines.push("");
          for (const m of d.machines) {
            const ver = m.daemonVersion ?? "unknown";
            const beat = m.lastHeartbeat
              ? new Date(m.lastHeartbeat).toISOString()
              : "never";
            lines.push(`  ${m.name}  [${m.status}]  daemon=${ver}  last=${beat}`);
            lines.push(`    id: ${m.id}`);
          }
          return lines.join("\n");
        }
      );
    });
}
