/**
 * commands/agents/update.ts — slock agents update
 *
 * Updates an existing agent. Capability-gated: `manageAgents` (owner/
 * admin only); members get FORBIDDEN.
 *
 * Field semantics:
 *   - `--display-name`, `--description`, `--avatar-url` accept the
 *     literal string `null` to clear the field (null is meaningful
 *     server-side; passing the empty string would set it to "" which
 *     is a different state). The CLI converts the literal `null` to
 *     a JSON null on the wire.
 *   - `--model`, `--reasoning-effort` are likewise either a value or
 *     `null` (only reasoningEffort is nullable; passing null on
 *     `--model` is INVALID_ARGS — model is required).
 *   - `--env KEY=VALUE` is repeatable; presence replaces the entire
 *     envVars object on the server (the API does not support
 *     incremental key edits). Pass `--clear-env` to set to null.
 *   - `--name` is intentionally absent — agent names are immutable.
 *     See `client.ts` Agent type JSDoc for the rationale.
 *   - `--status` is also intentionally absent — server-managed only,
 *     mutated via `start`/`stop`/`reset`.
 *
 * If no fields are passed, the command refuses with INVALID_ARGS to
 * avoid sending an empty PATCH (which would silently no-op
 * server-side and look successful — bad UX, surprising audit log).
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveAgentId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

function parseEnvVars(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new Error(
        `--env "${pair}" is malformed; expected KEY=VALUE with a non-empty key`
      );
    }
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

export function registerAgentUpdateCommand(parent: Command): void {
  parent
    .command("update")
    .description("Update an agent's mutable fields (requires manageAgents)")
    .requiredOption("--id <id>", "Agent UUID or name")
    .option(
      "--display-name <displayName>",
      'New display name (use literal "null" to clear)'
    )
    .option(
      "--description <description>",
      'New description (use literal "null" to clear)'
    )
    .option(
      "--avatar-url <url>",
      'New avatar URL (use literal "null" to reset to default)'
    )
    .option("--model <model>", "New model ID (cannot be cleared)")
    .option(
      "--reasoning-effort <effort>",
      `Reasoning effort: ${REASONING_EFFORTS.join("|")} or "null" to clear`
    )
    .option(
      "--env <KEY=VALUE>",
      "Replace envVars (repeatable; entire object replaced, not merged)",
      (val: string, prev: string[] = []) => [...prev, val],
      [] as string[]
    )
    .option("--clear-env", "Clear all envVars (sets to null)")
    .action(async (opts) => {
      // Sync arg validation: build the PATCH body and reject empties
      // before any auth/network call. Same temporal-ordering convention
      // as PR-A/PR-D.
      const body: Parameters<typeof ApiClient.prototype.updateAgent>[1] = {};

      if (opts.displayName !== undefined) {
        body.displayName = opts.displayName === "null" ? null : opts.displayName;
      }
      if (opts.description !== undefined) {
        body.description = opts.description === "null" ? null : opts.description;
      }
      if (opts.avatarUrl !== undefined) {
        body.avatarUrl = opts.avatarUrl === "null" ? null : opts.avatarUrl;
      }
      if (opts.model !== undefined) {
        if (opts.model === "null") {
          fail("INVALID_ARGS", "--model cannot be cleared (it is required on the agent)");
        }
        body.model = opts.model;
      }
      if (opts.reasoningEffort !== undefined) {
        if (opts.reasoningEffort === "null") {
          body.reasoningEffort = null;
        } else if (REASONING_EFFORTS.includes(opts.reasoningEffort as ReasoningEffort)) {
          body.reasoningEffort = opts.reasoningEffort as ReasoningEffort;
        } else {
          fail(
            "INVALID_ARGS",
            `--reasoning-effort must be one of ${REASONING_EFFORTS.join("|")} or "null", got "${opts.reasoningEffort}"`
          );
        }
      }

      if (opts.clearEnv && opts.env && opts.env.length > 0) {
        fail(
          "INVALID_ARGS",
          "--clear-env cannot be combined with --env (use one or the other)"
        );
      }
      if (opts.clearEnv) {
        body.envVars = null;
      } else if (opts.env && opts.env.length > 0) {
        try {
          body.envVars = parseEnvVars(opts.env);
        } catch (err) {
          fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
        }
      }

      if (Object.keys(body).length === 0) {
        fail(
          "INVALID_ARGS",
          "agents update requires at least one field flag (--display-name, --description, --avatar-url, --model, --reasoning-effort, --env, or --clear-env)"
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

      const updated = await client.updateAgent(agentId, body);
      success(updated, (d) => `Updated agent ${d.id} @${d.name}`);
    });
}
