/**
 * target.ts — Target parser and resolver.
 *
 * First-class module that handles all target string parsing and resolution.
 *
 * Target formats:
 *   #channel          → channel by name
 *   #channel:threadid → thread in channel
 *   dm:@peer          → DM with peer (agent or human)
 *   dm:@peer:threadid → thread in DM
 *
 * parse() is a pure function (no I/O, unit-testable).
 * resolve() calls the API to map names → UUIDs.
 */

import type { ApiClient } from "./client.js";

export type Target =
  | { type: "channel"; name: string; threadId?: string }
  | { type: "dm"; peer: string; threadId?: string };

/**
 * Parse a target string into a structured Target.
 * Pure function — no I/O.
 *
 * @throws Error if the target string is malformed.
 */
export function parseTarget(raw: string): Target {
  if (raw.startsWith("#")) {
    const body = raw.slice(1);
    if (!body) {
      throw new Error(`Invalid target "${raw}": channel name cannot be empty`);
    }
    const colonIdx = body.indexOf(":");
    if (colonIdx === -1) {
      return { type: "channel", name: body };
    }
    const name = body.slice(0, colonIdx);
    const threadId = body.slice(colonIdx + 1);
    if (!name) {
      throw new Error(`Invalid target "${raw}": channel name cannot be empty`);
    }
    if (!threadId) {
      throw new Error(`Invalid target "${raw}": thread ID cannot be empty`);
    }
    return { type: "channel", name, threadId };
  }

  if (raw.startsWith("dm:@")) {
    const body = raw.slice(4);
    if (!body) {
      throw new Error(`Invalid target "${raw}": peer name cannot be empty`);
    }
    const colonIdx = body.indexOf(":");
    if (colonIdx === -1) {
      return { type: "dm", peer: body };
    }
    const peer = body.slice(0, colonIdx);
    const threadId = body.slice(colonIdx + 1);
    if (!peer) {
      throw new Error(`Invalid target "${raw}": peer name cannot be empty`);
    }
    if (!threadId) {
      throw new Error(`Invalid target "${raw}": thread ID cannot be empty`);
    }
    return { type: "dm", peer, threadId };
  }

  throw new Error(
    `Invalid target "${raw}": must start with "#" (channel) or "dm:@" (DM). ` +
      `Examples: #general, dm:@alice, #general:abc123`
  );
}

/**
 * Resolve a parsed Target to a channel UUID.
 * Calls the API to look up channel/DM/thread IDs.
 */
export async function resolveTarget(
  client: ApiClient,
  target: Target
): Promise<string> {
  if (target.type === "channel") {
    // Look up channel by name
    const channels = await client.listChannels();
    const channel = channels.find(
      (c: { name: string }) => c.name === target.name
    );
    if (!channel) {
      throw new Error(`Channel "#${target.name}" not found`);
    }

    if (!target.threadId) {
      return channel.id;
    }

    // Resolve thread: threadId is the parent message short ID.
    // We need to find the full message ID and get/create the thread channel.
    const thread = await client.getOrCreateThread(channel.id, target.threadId);
    return thread.threadChannelId;
  }

  // DM resolution
  // First try to find peer as an agent, then as a user
  const agents = await client.listAgents();
  const agent = agents.find(
    (a: { name: string }) => a.name === target.peer
  );

  let dmChannelId: string;
  if (agent) {
    const dm = await client.findOrCreateDM({ agentId: agent.id });
    dmChannelId = dm.id;
  } else {
    // Try as a user — need to look up server members.
    // NOTE: server returns `userId`, not `id`. See client.listServerMembers
    // JSDoc for the latent-bug history.
    const members = await client.listServerMembers();
    const member = members.find((m) => m.name === target.peer);
    if (!member) {
      throw new Error(
        `Peer "@${target.peer}" not found as agent or server member`
      );
    }
    const dm = await client.findOrCreateDM({ userId: member.userId });
    dmChannelId = dm.id;
  }

  if (!target.threadId) {
    return dmChannelId;
  }

  const thread = await client.getOrCreateThread(dmChannelId, target.threadId);
  return thread.threadChannelId;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parsed shape of a `--thread` flag value. Either a raw UUID (no API
 * call needed to resolve) or a target string that still needs the API
 * to map name → UUID. Splitting parse from resolve lets callers run
 * the sync syntax check before `ensureValidToken()` so a malformed
 * `--thread` reports INVALID_ARGS regardless of auth state — same
 * temporal-ordering convention as `messages send` / `messages search`
 * (see PR-A `6543337` for the precedent).
 */
export type ThreadSpec =
  | { kind: "uuid"; uuid: string }
  | { kind: "target"; target: Target };

/**
 * Pure sync parse of a `--thread` flag value. Throws on syntax errors;
 * never makes API calls.
 *
 * Accepts two forms:
 *   - A raw UUID — assumed to be the thread channel id, wrapped as
 *     `{kind: "uuid"}`. This is what `threads list` (followed mode)
 *     and the server's follow/unfollow/done/undone endpoints emit, so
 *     round-tripping output → input must work without parsing.
 *   - A target string with an explicit thread segment:
 *     `#channel:parentMsgShortId` or `dm:@peer:parentMsgShortId`. The
 *     parent-message short id is what `messages send`/`read` already
 *     accept, so users who know the parent message but not the thread
 *     UUID can address it the same way they address the rest of the
 *     CLI.
 *
 * Anything else (a `#channel` without `:`, a `dm:@peer` without `:`,
 * or a non-UUID non-target string) is rejected — those are channel
 * targets, not thread targets, and silently treating a channel as a
 * thread would be very confusing.
 *
 * Callers should map the thrown error to INVALID_ARGS. The companion
 * `resolveThreadSpec` handles the async API path; mapping for *its*
 * errors is NOT_FOUND.
 */
export function parseThreadSpec(raw: string): ThreadSpec {
  if (UUID_RE.test(raw)) {
    return { kind: "uuid", uuid: raw };
  }
  // parseTarget throws on bad syntax — caller catches and maps to
  // INVALID_ARGS. We pre-check the threadId requirement here so the
  // error message is specific to threads ("must be a UUID or include
  // an explicit thread segment") rather than the generic target one.
  const target = parseTarget(raw);
  if (!target.threadId) {
    throw new Error(
      `Invalid thread "${raw}": must be a UUID or include an explicit thread segment ` +
        `(e.g. "#general:abc123" or "dm:@alice:abc123")`
    );
  }
  return { kind: "target", target };
}

/**
 * Async resolve of a parsed ThreadSpec to a thread channel UUID.
 *
 * For `{kind: "uuid"}` this is a no-op pass-through (still kept on
 * the async API for symmetry — callers don't have to special-case).
 * For `{kind: "target"}` this delegates to `resolveTarget` which hits
 * the API to map channel/peer names → UUIDs and creates the thread
 * channel via `getOrCreateThread` if needed.
 *
 * Errors thrown here come from API resolution failures (channel not
 * found, peer not found, parent message not found) — callers should
 * map them to NOT_FOUND.
 */
export async function resolveThreadSpec(
  client: ApiClient,
  spec: ThreadSpec
): Promise<string> {
  if (spec.kind === "uuid") {
    return spec.uuid;
  }
  return resolveTarget(client, spec.target);
}
