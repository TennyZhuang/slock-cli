/**
 * commands/agents/create.ts — slock agents create
 *
 * Creates a new agent on the active server. Capability-gated:
 * `manageAgents` (owner/admin only); members get FORBIDDEN.
 *
 * ─── Flag design ───
 *
 * `--name` (required) is the immutable canonical identifier — server
 * uniqueness invariant relies on it. The display label is set with
 * `--display-name` (or via `agents update` later); we don't
 * auto-derive one because the name pattern (`[A-Za-z][A-Za-z0-9_-]*`)
 * is not always pretty.
 *
 * `--runtime` defaults to whatever the server defaults to (currently
 * `claude`); omit to inherit. Same for `--model`. The CLI does NOT
 * validate runtime/model values against the shared `RUNTIMES` /
 * `RUNTIME_MODELS` enum locally — it lets the server reject invalid
 * combinations with a 400. Rationale: pinning the enum would couple
 * the CLI's release cycle to the shared package, and runtime/model
 * lists evolve frequently. Server-side rejection is the source of
 * truth.
 *
 * `--machine <id|name>` is optional. When set, name resolution goes
 * through `resolveMachineId`. When omitted, the server auto-assigns
 * the first available machine (or leaves the agent unassigned if
 * none are available — non-fatal).
 *
 * `--env KEY=VALUE` is repeatable. Keys must match
 * `^[A-Za-z_][A-Za-z0-9_]*$` (the server validates and rejects
 * invalid keys with a detailed error). The CLI does NOT validate
 * locally for the same reason as runtime/model — server is source of
 * truth. We do reject obviously malformed input ("missing `=`")
 * locally so users get a tighter diagnostic on typos.
 *
 * ─── Auto-start gotcha ───
 *
 * If the agent is created with a machineId (either supplied or
 * auto-assigned), the server *attempts* to auto-start it. If the
 * auto-start fails (e.g. machine offline), the agent is still
 * created — the CLI doesn't see the failure and the response shows
 * status="inactive". Callers who care about the agent being live
 * should follow the create with `agents start --id <id>` and check
 * the result, or poll `agents get` for status changes.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { resolveMachineId } from "../../resolvers.js";
import { success, fail } from "../../output.js";

const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

function parseEnvVars(pairs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      // eq === -1: no `=`; eq === 0: empty key
      throw new Error(
        `--env "${pair}" is malformed; expected KEY=VALUE with a non-empty key`
      );
    }
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    out[key] = value;
  }
  return out;
}

export function registerAgentCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description("Create a new agent (requires manageAgents capability)")
    .requiredOption("--name <name>", "Agent name (immutable, must be unique on this server)")
    .option("--display-name <displayName>", "Human-readable display label (defaults to name)")
    .option("--description <description>", "Free-text description (max 3000 chars)")
    .option("--runtime <runtime>", "Runtime ID (e.g. claude, codex, kimi); server-default if omitted")
    .option("--model <model>", "Model ID for the chosen runtime; server-default if omitted")
    .option(
      "--reasoning-effort <effort>",
      `Reasoning effort for codex runtime: ${REASONING_EFFORTS.join("|")}`
    )
    .option("--machine <id>", "Machine UUID or name to assign (server auto-assigns if omitted)")
    .option(
      "--env <KEY=VALUE>",
      "Environment variable for the agent process (repeatable)",
      (val: string, prev: string[] = []) => [...prev, val],
      [] as string[]
    )
    .action(async (opts) => {
      // Sync arg validation runs before auth so syntax errors win over
      // AUTH_FAILED — same temporal-ordering convention as PR-A/PR-D.
      let envVars: Record<string, string> | undefined;
      if (opts.env && opts.env.length > 0) {
        try {
          envVars = parseEnvVars(opts.env);
        } catch (err) {
          fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
        }
      }

      let reasoningEffort: ReasoningEffort | undefined;
      if (opts.reasoningEffort !== undefined) {
        if (!REASONING_EFFORTS.includes(opts.reasoningEffort)) {
          fail(
            "INVALID_ARGS",
            `--reasoning-effort must be one of ${REASONING_EFFORTS.join("|")}, got "${opts.reasoningEffort}"`
          );
        }
        reasoningEffort = opts.reasoningEffort;
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      let machineId: string | undefined;
      if (opts.machine) {
        try {
          machineId = await resolveMachineId(client, opts.machine);
        } catch (err) {
          fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
        }
      }

      const body: Parameters<typeof client.createAgent>[0] = { name: opts.name };
      if (opts.description !== undefined) body.description = opts.description;
      if (opts.runtime !== undefined) body.runtime = opts.runtime;
      if (opts.model !== undefined) body.model = opts.model;
      if (reasoningEffort !== undefined) body.reasoningEffort = reasoningEffort;
      if (machineId !== undefined) body.machineId = machineId;
      if (envVars !== undefined) body.envVars = envVars;

      const created = await client.createAgent(body);

      // If --display-name was supplied, follow the create with a PATCH.
      // The create endpoint doesn't accept displayName; it's an
      // update-only field. Two-call shape is consistent with the web
      // UI's create-then-edit flow.
      let final = created;
      if (opts.displayName !== undefined) {
        final = await client.updateAgent(created.id, {
          displayName: opts.displayName,
        });
      }

      success(
        final,
        (d) =>
          `Created agent ${d.id} @${d.name}${
            d.machineId ? ` (machine=${d.machineId})` : " (no machine assigned)"
          }`
      );
    });
}
