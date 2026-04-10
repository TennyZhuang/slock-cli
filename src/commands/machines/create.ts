/**
 * commands/machines/create.ts — slock machines create
 *
 * Registers a new machine on the current server and prints the
 * one-time API key. The server only returns the API key on this
 * single response — it cannot be retrieved again.
 *
 * Output options:
 *   --output json (default)  — full envelope with apiKey field
 *   --output env             — single line: SLOCK_MACHINE_API_KEY=sk_...
 *   --output shell           — exportable: export SLOCK_MACHINE_API_KEY=sk_...
 *
 * --save-to <path> writes the apiKey alone to a file with mode 0600,
 * so it can be passed to the daemon without ever being captured by
 * shell history. The file contains only the key (no trailing newline
 * by default; daemon scripts can `cat` it directly).
 */

import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";

export function registerMachineCreateCommand(parent: Command): void {
  parent
    .command("create")
    .description(
      "Register a new machine and print its one-time API key (cannot be retrieved later)"
    )
    .requiredOption("--name <name>", "Machine name")
    .option(
      "--output <format>",
      "Key output format: json (default) | env | shell",
      "json"
    )
    .option(
      "--save-to <path>",
      "Write the API key alone to this file (mode 0600). Parent dir must exist."
    )
    .action(async (opts) => {
      const outputFormat = opts.output as string;
      if (!["json", "env", "shell"].includes(outputFormat)) {
        fail(
          "INVALID_ARGS",
          `--output must be one of: json, env, shell (got "${outputFormat}")`
        );
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const result = await client.registerMachine(opts.name);

      // Persist to file before producing output, so a successful return
      // implies the key is captured. If file write fails, surface that
      // immediately — the key is otherwise lost.
      if (opts.saveTo) {
        const target = path.resolve(opts.saveTo);
        try {
          fs.writeFileSync(target, result.apiKey, { mode: 0o600 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          fail(
            "GENERAL_ERROR",
            `Machine was created (id=${result.machine.id}) but writing API key to ${target} failed: ${msg}. The key is in the JSON response below — capture it now or rotate it.`
          );
        }
      }

      success(
        {
          machine: {
            id: result.machine.id,
            name: result.machine.name,
            serverId: result.machine.serverId,
            status: result.machine.status,
          },
          apiKey: result.apiKey,
          savedTo: opts.saveTo ? path.resolve(opts.saveTo) : null,
        },
        (d) => {
          if (outputFormat === "env") {
            return `SLOCK_MACHINE_API_KEY=${d.apiKey}`;
          }
          if (outputFormat === "shell") {
            return `export SLOCK_MACHINE_API_KEY=${d.apiKey}`;
          }
          // json text-mode fallback (should not normally hit since
          // --format json bypasses the formatter, but kept for completeness)
          const lines = [
            `Machine created: ${d.machine.name} (${d.machine.id})`,
            `API key: ${d.apiKey}`,
            "Save this key now — it cannot be retrieved later.",
          ];
          if (d.savedTo) lines.push(`Written to: ${d.savedTo}`);
          return lines.join("\n");
        }
      );
    });
}
