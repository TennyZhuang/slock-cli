/**
 * commands/profile/list.ts — slock profile list
 *
 * Lists all locally-stored profiles and marks the active one. Pure local
 * read — does not touch the server. Existed implicitly inside `auth status`
 * before; lifted to a dedicated command so users discovering the CLI through
 * `slock profile --help` find the listing immediately.
 */

import type { Command } from "commander";
import { getGlobalConfig, getProfile, listProfiles } from "../../config.js";
import { success } from "../../output.js";

export function registerProfileListCommand(parent: Command): void {
  parent
    .command("list")
    .description("List all locally-stored profiles")
    .action(() => {
      const active = getGlobalConfig().activeProfile;
      const names = listProfiles();
      const profiles = names.map((name) => {
        const p = getProfile(name);
        return {
          name,
          active: name === active,
          serverUrl: p?.serverUrl ?? null,
          serverId: p?.serverId ?? null,
          userId: p?.userId ?? null,
        };
      });
      success(
        { activeProfile: active, profiles },
        (d) => {
          if (d.profiles.length === 0) {
            return "No profiles. Run `slock auth login --profile <name>` to create one.";
          }
          return d.profiles
            .map(
              (p) =>
                `${p.active ? "*" : " "} ${p.name.padEnd(20)} ${p.serverUrl ?? "(unresolved)"}`
            )
            .join("\n");
        }
      );
    });
}
