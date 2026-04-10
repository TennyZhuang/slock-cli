/**
 * commands/machines/rotate-key.ts — slock machines rotate-key
 *
 * Rotates the API key for an existing machine, returning the new key.
 * Same one-time-output guarantee as `machines create`.
 */

import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { success, fail } from "../../output.js";
import { resolveMachineId } from "./resolve.js";

export function registerMachineRotateKeyCommand(parent: Command): void {
  parent
    .command("rotate-key")
    .description("Rotate the API key for a machine")
    .option("--id <machineId>", "Machine ID")
    .option("--name <name>", "Machine name (resolved against the machine list)")
    .option(
      "--output <format>",
      "Key output format: json (default) | env | shell",
      "json"
    )
    .option(
      "--save-to <path>",
      "Write the new API key alone to this file (mode 0600)"
    )
    .action(async (opts) => {
      const outputFormat = opts.output as string;
      if (!["json", "env", "shell"].includes(outputFormat)) {
        fail(
          "INVALID_ARGS",
          `--output must be one of: json, env, shell (got "${outputFormat}")`
        );
      }
      if (!opts.id && !opts.name) {
        fail("INVALID_ARGS", "Either --id or --name is required");
      }

      const auth = await ensureValidToken();
      const client = new ApiClient({
        serverUrl: auth.serverUrl,
        serverId: auth.serverId,
        accessToken: auth.accessToken,
      });

      const machineId = opts.id ?? (await resolveMachineId(client, opts.name));
      const result = await client.rotateMachineKey(machineId);

      if (opts.saveTo) {
        const target = path.resolve(opts.saveTo);
        try {
          // The `mode` option on writeFileSync only applies when the file
          // is created. Re-running rotate-key against an existing file
          // would silently leave whatever permissions were there. chmod
          // after write is the only reliable way to guarantee 0600.
          fs.writeFileSync(target, result.apiKey, { mode: 0o600 });
          fs.chmodSync(target, 0o600);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Server already rotated the key — the previous key is dead and
          // the new key is gone forever if we lose it here. Print to stderr
          // BEFORE fail() so automation can recover regardless of --format.
          process.stderr.write(`RECOVERY_API_KEY=${result.apiKey}\n`);
          fail(
            "GENERAL_ERROR",
            `Key was rotated for machine ${machineId} but writing to ${target} failed: ${msg}. The new key was printed to stderr as RECOVERY_API_KEY=<value> — capture it now or rotate again.`
          );
        }
      }

      success(
        {
          machineId,
          apiKey: result.apiKey,
          savedTo: opts.saveTo ? path.resolve(opts.saveTo) : null,
        },
        (d) => {
          if (outputFormat === "env") return `SLOCK_MACHINE_API_KEY=${d.apiKey}`;
          if (outputFormat === "shell") {
            return `export SLOCK_MACHINE_API_KEY=${d.apiKey}`;
          }
          const lines = [
            `Rotated key for machine ${d.machineId}`,
            `New API key: ${d.apiKey}`,
            "Save this key now — it cannot be retrieved later.",
          ];
          if (d.savedTo) lines.push(`Written to: ${d.savedTo}`);
          return lines.join("\n");
        }
      );
    });
}
