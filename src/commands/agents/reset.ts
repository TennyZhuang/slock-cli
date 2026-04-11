/**
 * commands/agents/reset.ts — slock agents reset
 *
 * Resets an agent's runtime state. Capability-gated: `manageAgents`
 * (owner/admin only).
 *
 * The `--mode` flag picks one of three reset levels (server-side
 * `routes/agents.ts` reset handler):
 *
 *   - `restart` (default) — stop and restart, preserves `sessionId`.
 *     Full Claude CLI context (memory + tool history within the
 *     session) is restored via `--resume`. Closest to "recover from
 *     a hung process". Not destructive; no `--yes`.
 *
 *   - `session` — stop, null `sessionId`, restart with a fresh
 *     session. The agent loses its in-CLI conversation history but
 *     KEEPS its workspace files (`~/.slock/agents/{id}/MEMORY.md`,
 *     `notes/`, etc.) so it can re-read its persistent state on next
 *     start. Loss is recoverable; no `--yes`.
 *
 *   - `full` — same as `session` PLUS sends `agent:reset-workspace`
 *     to the daemon, which deletes `~/.slock/agents/{id}/`.
 *     MEMORY.md and notes are gone for good. **Genuinely destructive
 *     of agent state** — requires `--yes` per the tasks/delete.ts
 *     convention. The agent record itself stays (so you can rebuild
 *     it from scratch by talking to the agent again), but everything
 *     it remembered is gone.
 *
 * The `--yes` gate runs FIRST when `--mode full`, before any other
 * validation, matching the convention.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

const RESET_MODES = ["restart", "session", "full"] as const;
type ResetMode = (typeof RESET_MODES)[number];

export function registerAgentResetCommand(parent: Command): void {
  parent
    .command("reset")
    .description("Reset an agent (restart | session | full — requires manageAgents)")
    .requiredOption("--id <id>", "Agent UUID or name")
    .option(
      "--mode <mode>",
      `Reset depth: ${RESET_MODES.join("|")} (default: restart)`,
      "restart"
    )
    .option(
      "--yes",
      "Confirm --mode full (required ONLY for --mode full; ignored otherwise)"
    )
    .action(async (opts) => {
      // Sync validation: mode enum and the --yes gate for `full` run
      // before any auth/network call.
      if (!RESET_MODES.includes(opts.mode)) {
        fail(
          "INVALID_ARGS",
          `--mode must be one of ${RESET_MODES.join("|")}, got "${opts.mode}"`
        );
      }
      const mode = opts.mode as ResetMode;

      // --yes gate for the destructive variant only. `restart` and
      // `session` are recoverable so they don't need the gate.
      if (mode === "full" && !opts.yes) {
        fail(
          "INVALID_ARGS",
          "agents reset --mode full deletes the agent workspace and is destructive; requires --yes to confirm"
        );
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let agentId;
      try {
        agentId = await resolveAgentId(client, opts.id);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      await client.resetAgent(agentId, mode);
      success(
        { agentId, mode, reset: true },
        (d) => `Reset agent ${d.agentId} (mode=${d.mode})`
      );
    });
}
