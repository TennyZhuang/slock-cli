/**
 * commands/messages/search.ts — slock messages search
 *
 * Full-text search over messages the caller can see. Wraps
 * `GET /api/messages/search`. Without `--target`, search is server-wide;
 * with `--target`, it is scoped to a single channel/DM/thread.
 */

import type { Command } from "commander";
import { ensureValidToken } from "../../auth.js";
import { ApiClient } from "../../client.js";
import { parseTarget, resolveTarget } from "../../target.js";
import { success, fail } from "../../output.js";

const SERVER_LIMIT_MAX = 50;
const SERVER_LIMIT_DEFAULT = 20;

interface SearchOptions {
  query: string;
  target?: string;
  sender?: string;
  after?: string;
  before?: string;
  limit?: string;
  offset?: string;
}

export function registerSearchCommand(parent: Command): void {
  parent
    .command("search")
    .description("Search messages by full-text query")
    .requiredOption("--query <text>", "Search query (required)")
    .option(
      "--target <target>",
      "Scope to one channel/DM/thread: #channel, dm:@peer, #channel:threadid, dm:@peer:threadid"
    )
    .option("--sender <senderId>", "Filter by sender id (user or agent UUID)")
    .option("--after <iso8601>", "Only messages on/after this timestamp")
    .option("--before <iso8601>", "Only messages on/before this timestamp")
    .option(
      "--limit <n>",
      `Page size (server max ${SERVER_LIMIT_MAX}, default ${SERVER_LIMIT_DEFAULT})`
    )
    .option("--offset <n>", "Pagination offset", "0")
    .action(async (opts: SearchOptions) => {
      await runSearch(opts);
    });
}

/**
 * Exported so the top-level `slock search <query>` alias can reuse the
 * exact same execution path with one fewer flag (the query is positional).
 */
export async function runSearch(opts: SearchOptions): Promise<void> {
  const query = String(opts.query ?? "").trim();
  if (!query) {
    fail("INVALID_ARGS", "--query (or positional query) is required");
  }

  const limit = opts.limit !== undefined ? parseLimit(opts.limit) : undefined;
  const offset = opts.offset !== undefined ? parseOffset(opts.offset) : 0;

  const auth = await ensureValidToken();
  const client = new ApiClient({
    serverUrl: auth.serverUrl,
    serverId: auth.serverId,
    accessToken: auth.accessToken,
  });

  let channelId: string | undefined;
  if (opts.target) {
    let parsed;
    try {
      parsed = parseTarget(opts.target);
    } catch (err) {
      fail("INVALID_ARGS", err instanceof Error ? err.message : String(err));
    }
    try {
      channelId = await resolveTarget(client, parsed);
    } catch (err) {
      fail("NOT_FOUND", err instanceof Error ? err.message : String(err));
    }
  }

  const result = await client.searchMessages({
    query,
    channelId,
    senderId: opts.sender,
    after: opts.after,
    before: opts.before,
    limit,
    offset,
  });

  success(
    {
      results: result.results,
      hasMore: result.hasMore,
      nextOffset: result.hasMore
        ? offset + result.results.length
        : null,
    },
    (d) => formatResults(d.results, d.hasMore)
  );
}

function parseLimit(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    fail("INVALID_ARGS", `--limit must be a positive integer, got "${raw}"`);
  }
  if (n > SERVER_LIMIT_MAX) {
    // Server clamps anyway, but be explicit so callers see the cap.
    return SERVER_LIMIT_MAX;
  }
  return Math.floor(n);
}

function parseOffset(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    fail("INVALID_ARGS", `--offset must be a non-negative integer, got "${raw}"`);
  }
  return Math.floor(n);
}

function formatResults(
  results: Array<{
    seq: number;
    senderName: string;
    channelName: string;
    channelType: "channel" | "dm" | "thread";
    snippet: string;
    createdAt: string;
  }>,
  hasMore: boolean
): string {
  if (results.length === 0) return "(no results)";
  const lines = results.map((r) => {
    const where =
      r.channelType === "channel" ? `#${r.channelName}` : r.channelName;
    return `[${r.seq}] ${where} — ${r.senderName}: ${r.snippet}`;
  });
  if (hasMore) lines.push("(more results — use --offset to paginate)");
  return lines.join("\n");
}
