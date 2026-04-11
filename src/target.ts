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
