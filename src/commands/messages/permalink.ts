/**
 * commands/messages/permalink.ts — slock messages permalink
 *
 * Builds a Slock message permalink from a target and message ID.
 * By default returns the relative permalink path. Use --absolute-url
 * to emit a full URL when the app base URL is known or can be inferred.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { fail, success } from "../../output.js";
import { formatPermalink, parseTarget, resolveTarget } from "../../target.js";

function inferAppUrl(serverUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(serverUrl);
  } catch {
    return null;
  }

  if (url.hostname === "api.slock.ai") {
    url.hostname = "app.slock.ai";
    return url.origin;
  }

  if (url.hostname === "localhost" && url.port === "3001") {
    url.port = "3000";
    return url.origin;
  }

  if (url.hostname.startsWith("api.")) {
    url.hostname = `app.${url.hostname.slice(4)}`;
    return url.origin;
  }

  return null;
}

export function registerPermalinkCommand(parent: Command): void {
  parent
    .command("permalink")
    .description("Build a permalink for a message")
    .requiredOption(
      "--target <target>",
      "Target: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid, or a Slock permalink"
    )
    .requiredOption("--message-id <id>", "Full message UUID")
    .option(
      "--absolute-url",
      "Emit a full web URL instead of a relative /s/... path"
    )
    .option(
      "--app-url <url>",
      "Explicit Slock web base URL to use with --absolute-url"
    )
    .action(async (opts) => {
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

      let channelId: string;
      try {
        channelId = await resolveTarget(client, target);
      } catch (err) {
        fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
      }

      const server = await client.getServerInfo();
      const path = formatPermalink({
        serverSlug: server.slug,
        channelId,
        messageId: opts.messageId,
      });

      let url: string | null = null;
      if (opts.absoluteUrl) {
        const appUrl =
          opts.appUrl ?? process.env.SLOCK_APP_URL ?? inferAppUrl(auth.serverUrl);
        if (!appUrl) {
          fail(
            "INVALID_ARGS",
            "Cannot infer app URL from configured server URL. Pass --app-url or set SLOCK_APP_URL."
          );
        }
        url = `${appUrl.replace(/\/$/, "")}${path}`;
      }

      success(
        {
          path,
          url,
          channelId,
          messageId: opts.messageId,
          serverSlug: server.slug,
        },
        (data) => data.url ?? data.path
      );
    });
}
