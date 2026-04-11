/**
 * client.ts — HTTP client wrapping all Slock API calls.
 *
 * Automatically attaches Authorization and X-Server-Id headers.
 * Provides typed methods for each API endpoint.
 */

import { fail } from "./output.js";

export interface ApiClientConfig {
  serverUrl: string;
  serverId: string;
  accessToken: string;
}

export class ApiClient {
  private serverUrl: string;
  private serverId: string;
  private accessToken: string;

  constructor(config: ApiClientConfig) {
    this.serverUrl = config.serverUrl.replace(/\/$/, "");
    this.serverId = config.serverId;
    this.accessToken = config.accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.serverUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "X-Server-Id": this.serverId,
      ...extraHeaders,
    };

    if (body !== undefined && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body:
          body instanceof FormData
            ? body
            : body !== undefined
              ? JSON.stringify(body)
              : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fail("NETWORK_ERROR", `Failed to connect to ${this.serverUrl}: ${msg}`);
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      const message = errorBody.error ?? `HTTP ${res.status}`;

      if (res.status === 401) {
        fail("AUTH_EXPIRED", message);
      } else if (res.status === 403) {
        fail("FORBIDDEN", message);
      } else if (res.status === 404) {
        fail("NOT_FOUND", message);
      } else {
        fail("GENERAL_ERROR", message);
      }
    }

    return (await res.json()) as T;
  }

  // ── Channels ──────────────────────────────────────────

  async listChannels(): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      type: string;
      joined: boolean;
    }>
  > {
    return this.request("GET", "/api/channels");
  }

  async joinChannel(channelId: string): Promise<void> {
    await this.request("POST", `/api/channels/${channelId}/join`);
  }

  async createChannel(
    name: string,
    description?: string
  ): Promise<{ id: string; name: string }> {
    return this.request("POST", "/api/channels", { name, description });
  }

  async getChannelMembers(
    channelId: string
  ): Promise<Array<{ id: string; name: string; type: string }>> {
    return this.request("GET", `/api/channels/${channelId}/members`);
  }

  /**
   * Fetch a single channel by id. Returns the raw channel row from
   * `channelService.getChannel`: id, serverId, name, description (nullable),
   * type ('channel'|'dm'|'thread'), parentMessageId (nullable for non-thread),
   * createdAt, deletedAt (nullable — server filters out deleted channels by
   * default, so this is normally null).
   */
  async getChannel(channelId: string): Promise<{
    id: string;
    serverId: string;
    name: string;
    description: string | null;
    type: "channel" | "dm" | "thread";
    parentMessageId: string | null;
    createdAt: string;
    deletedAt: string | null;
  }> {
    return this.request("GET", `/api/channels/${channelId}`);
  }

  /**
   * Soft-delete a channel. The server enforces that the built-in `#all`
   * channel cannot be deleted (returns 403 with that exact message).
   * Permission gating: regular channels require `manageChannels` capability
   * (admin/owner only); DMs require participant. The destructive nature is
   * gated CLI-side via the standard `--yes` convention; see
   * `commands/tasks/delete.ts` module header for the canonical reference.
   */
  async deleteChannel(channelId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/channels/${channelId}`);
  }

  /**
   * Leave a channel (self). The server rejects DM channels with 403 — DMs
   * use the soft-delete path instead. The CLI surfaces the server's 403
   * as `FORBIDDEN`.
   */
  async leaveChannel(channelId: string): Promise<{ ok: true }> {
    return this.request("POST", `/api/channels/${channelId}/leave`);
  }

  /**
   * Mark a channel as read up to a specific seq. The server requires the
   * `seq` body field — it does NOT default to "latest" if omitted (returns
   * 400 instead). Use `markChannelReadAll` for "mark fully read" semantics.
   */
  async markChannelRead(
    channelId: string,
    seq: number
  ): Promise<{ ok: true }> {
    return this.request("POST", `/api/channels/${channelId}/read`, { seq });
  }

  /**
   * Mark a channel as fully read (latest seq). Returns the seq the server
   * actually marked read at, which the CLI surfaces in JSON for callers
   * that need to compute "what's new since I last read this."
   */
  async markChannelReadAll(
    channelId: string
  ): Promise<{ ok: true; seq: number }> {
    return this.request("POST", `/api/channels/${channelId}/read-all`);
  }

  /**
   * Add a channel member. Server accepts either `{agentId}` or `{userId}`
   * — exactly one must be provided. Auth: regular channels require
   * `manageChannels` capability; DM channels require participant.
   * Validation errors (e.g. agent not in this server, user not a member
   * of this server) come back as 400 → `GENERAL_ERROR`.
   */
  async addChannelMember(
    channelId: string,
    target: { agentId: string } | { userId: string }
  ): Promise<{ ok: true }> {
    return this.request("POST", `/api/channels/${channelId}/members`, target);
  }

  /**
   * Remove a channel member. The server splits agent and user removal into
   * two distinct routes (`/members/agent/:id` vs `/members/user/:id`), so
   * the caller must commit to the member type up front. The CLI exposes
   * this via `--agent` / `--user` mutually-exclusive flags.
   *
   * DM-specific quirk: removing a user from a DM is only permitted if the
   * caller is removing themselves (server returns 403 otherwise).
   */
  async removeChannelAgent(
    channelId: string,
    agentId: string
  ): Promise<{ ok: true }> {
    return this.request(
      "DELETE",
      `/api/channels/${channelId}/members/agent/${agentId}`
    );
  }

  async removeChannelUser(
    channelId: string,
    userId: string
  ): Promise<{ ok: true }> {
    return this.request(
      "DELETE",
      `/api/channels/${channelId}/members/user/${userId}`
    );
  }

  async findOrCreateDM(
    target: { agentId: string } | { userId: string }
  ): Promise<{ id: string }> {
    return this.request("POST", "/api/channels/dm", target);
  }

  async getOrCreateThread(
    channelId: string,
    parentMessageId: string
  ): Promise<{ threadChannelId: string }> {
    return this.request("POST", `/api/channels/${channelId}/threads`, {
      parentMessageId,
    });
  }

  // ── Messages ──────────────────────────────────────────

  /**
   * List messages for a channel.
   *
   * CLI enrichment: the command layer will compute latestSeq/oldestSeq
   * from the messages array for incremental polling.
   */
  async listMessages(
    channelId: string,
    opts?: { limit?: number; before?: number }
  ): Promise<{
    messages: Array<{
      id: string;
      seq: number;
      senderType: string;
      senderId: string;
      senderName?: string;
      content: string;
      createdAt: string;
    }>;
    historyLimited?: boolean;
  }> {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.before) params.set("before", String(opts.before));
    const qs = params.toString();
    return this.request(
      "GET",
      `/api/messages/channel/${channelId}${qs ? `?${qs}` : ""}`
    );
  }

  async syncMessages(
    sinceSeq: number,
    channelId?: string,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      seq: number;
      channelId: string;
      senderType: string;
      senderId: string;
      senderName?: string;
      content: string;
      createdAt: string;
    }>
  > {
    const params = new URLSearchParams();
    params.set("since_seq", String(sinceSeq));
    if (channelId) params.set("channel_id", channelId);
    if (limit) params.set("limit", String(limit));
    return this.request("GET", `/api/messages/sync?${params.toString()}`);
  }

  async sendMessage(
    channelId: string,
    content: string,
    attachmentIds?: string[]
  ): Promise<{
    id: string;
    seq: number;
    content: string;
    createdAt: string;
  }> {
    return this.request("POST", "/api/messages", {
      channelId,
      content,
      attachmentIds,
    });
  }

  /**
   * Fetch a single message plus its surrounding context.
   *
   * The server hardcodes the context window at ±15 messages around the
   * target message; there is no query parameter to widen or narrow it.
   * If callers need more context they should fall back to `listMessages`
   * with a `before`/`after` cursor anchored at the target seq.
   */
  async getMessageContext(messageId: string): Promise<{
    channelId: string;
    targetMessageId: string;
    hasOlder: boolean;
    hasNewer: boolean;
    messages: Array<{
      id: string;
      seq: number;
      senderType: string;
      senderId: string;
      senderName?: string;
      content: string;
      createdAt: string;
    }>;
  }> {
    return this.request(
      "GET",
      `/api/messages/context/${encodeURIComponent(messageId)}`
    );
  }

  /**
   * Search messages across the active server.
   *
   * Wraps `GET /api/messages/search`. Server clamps `limit` to 50 and
   * defaults to 20 when omitted. Without `channelId` the search is
   * server-wide; with `channelId` it is scoped to that channel and the
   * caller must already be a member (server returns 403 otherwise).
   *
   * Date filters (`after` / `before`) accept any string the server can
   * parse with `new Date(...)`; ISO 8601 is the safe choice.
   */
  async searchMessages(opts: {
    query: string;
    channelId?: string;
    senderId?: string;
    after?: string;
    before?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    results: Array<{
      id: string;
      seq: number;
      channelId: string;
      threadId: string | null;
      parentMessageId: string | null;
      parentMessageContent: string | null;
      parentChannelId: string;
      parentChannelName: string;
      parentChannelType: "channel" | "dm" | "thread";
      senderId: string;
      senderType: string;
      senderName: string;
      channelName: string;
      channelType: "channel" | "dm" | "thread";
      content: string;
      snippet: string;
      createdAt: string;
    }>;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    params.set("q", opts.query);
    if (opts.channelId) params.set("channelId", opts.channelId);
    if (opts.senderId) params.set("senderId", opts.senderId);
    if (opts.after) params.set("after", opts.after);
    if (opts.before) params.set("before", opts.before);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    return this.request("GET", `/api/messages/search?${params.toString()}`);
  }

  // ── Tasks ─────────────────────────────────────────────

  async listTasks(
    channelId: string,
    status?: string
  ): Promise<{
    tasks: Array<{
      id: string;
      taskNumber: number;
      title: string;
      description: string | null;
      status: string;
      claimedByType: string | null;
      claimedById: string | null;
      claimedByName: string | null;
    }>;
  }> {
    const qs = status ? `?status=${status}` : "";
    return this.request("GET", `/api/tasks/channel/${channelId}${qs}`);
  }

  async createTasks(
    channelId: string,
    tasks: Array<{ title: string; description?: string }>
  ): Promise<{ tasks: Array<{ id: string; taskNumber: number; title: string }> }> {
    return this.request("POST", `/api/tasks/channel/${channelId}`, { tasks });
  }

  async claimTask(
    taskId: string
  ): Promise<{ task: { id: string; status: string } }> {
    return this.request("PATCH", `/api/tasks/${taskId}/claim`);
  }

  async unclaimTask(
    taskId: string
  ): Promise<{ task: { id: string; status: string } }> {
    return this.request("PATCH", `/api/tasks/${taskId}/unclaim`);
  }

  async updateTaskStatus(
    taskId: string,
    status: string
  ): Promise<{ task: { id: string; status: string } }> {
    return this.request("PATCH", `/api/tasks/${taskId}/status`, { status });
  }

  /**
   * Delete a task. Server requires either the task creator or a server
   * admin/owner; otherwise returns 403. Returns `{ok: true}` on success.
   * The task UUID can be obtained from `listTasks` (it's the message id
   * of the task-typed message), or via the `resolveTaskIds` helper that
   * existing commands use to map task numbers → UUIDs.
   */
  async deleteTask(taskId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/tasks/${taskId}`);
  }

  /**
   * Promote an existing message to a task. The server resolves the
   * message's channel internally; thread messages are rejected with 409.
   * Returns the enriched task row (with `taskNumber`, `title`, `status`,
   * `createdByName`, etc.) so callers can render it without a follow-up
   * `listTasks` call.
   */
  async convertMessageToTask(messageId: string): Promise<{
    task: {
      id: string;
      taskNumber: number;
      title: string;
      description: string | null;
      status: string;
      channelId: string;
      messageId: string;
      createdByType: string;
      createdById: string;
      createdByName: string;
      claimedByType: string | null;
      claimedById: string | null;
      claimedByName: string | null;
      claimedAt: string | null;
      completedAt: string | null;
    };
  }> {
    return this.request("POST", "/api/tasks/convert-message", { messageId });
  }

  // ── Agents ────────────────────────────────────────────

  async listAgents(): Promise<
    Array<{
      id: string;
      name: string;
      displayName: string | null;
      status: string;
      activity: string;
    }>
  > {
    return this.request("GET", "/api/agents");
  }

  // ── Server ────────────────────────────────────────────

  /**
   * List members of the active server.
   *
   * NOTE: the server returns `userId` (not `id`) — `getServerMembers` in
   * `serverService.ts` strips the email and aliases the join'd `users.id`
   * column to `userId` in the SELECT projection. The returned objects have:
   * `userId, name, displayName, avatarUrl, role, joinedAt, gravatarHash`.
   *
   * Prior to PR-C this client typed the field as `id`, which was a latent
   * bug — the `dm:@username` resolution path in `target.ts:resolveTarget`
   * would `findOrCreateDM({userId: undefined})` whenever the peer wasn't
   * an agent. The path was simply never exercised by tests. Fixed in PR-C
   * along with the channel-members work that surfaced it.
   */
  async listServerMembers(): Promise<
    Array<{
      userId: string;
      name: string;
      displayName: string | null;
      avatarUrl: string | null;
      role: string;
      joinedAt: string;
      gravatarHash: string;
    }>
  > {
    return this.request("GET", `/api/servers/${this.serverId}/members`);
  }

  async getServerInfo(): Promise<{ id: string; name: string; slug: string }> {
    return this.request("GET", `/api/servers/${this.serverId}`);
  }

  // ── Auth ──────────────────────────────────────────────

  async getMe(): Promise<{
    id: string;
    email: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
  }> {
    return this.request("GET", "/api/auth/me");
  }

  // ── Machines ──────────────────────────────────────────

  async listMachines(): Promise<{
    machines: Array<{
      id: string;
      name: string;
      serverId: string;
      status: string;
      lastHeartbeat: string | null;
      daemonVersion?: string | null;
      // Server returns `runtimes: string[]` from buildMachineReadModel
      // (services/machineReadModel.ts). The field is unused by the
      // current `machines list` command but is the accurate shape, so
      // future consumers get correct types out of the box.
      runtimes?: string[];
    }>;
    latestDaemonVersion: string | null;
  }> {
    return this.request("GET", `/api/servers/${this.serverId}/machines`);
  }

  async registerMachine(name: string): Promise<{
    machine: {
      id: string;
      name: string;
      serverId: string;
      status: string;
    };
    apiKey: string;
  }> {
    return this.request("POST", `/api/servers/${this.serverId}/machines`, {
      name,
    });
  }

  async renameMachine(
    machineId: string,
    name: string
  ): Promise<{
    id: string;
    name: string;
    serverId: string;
    // Server currently returns the raw machine row including apiKeyHash.
    // Callers MUST strip secret-bearing fields before surfacing the
    // response to users; see commands/machines/rename.ts for the
    // allow-list projection.
    [extra: string]: unknown;
  }> {
    return this.request(
      "PATCH",
      `/api/servers/${this.serverId}/machines/${machineId}`,
      { name }
    );
  }

  async deleteMachine(machineId: string): Promise<{ ok: true }> {
    return this.request(
      "DELETE",
      `/api/servers/${this.serverId}/machines/${machineId}`
    );
  }

  async rotateMachineKey(machineId: string): Promise<{ apiKey: string }> {
    return this.request(
      "POST",
      `/api/servers/${this.serverId}/machines/${machineId}/rotate-key`
    );
  }

  // ── Attachments ───────────────────────────────────────

  async uploadFile(
    channelId: string,
    filePath: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<{
    attachments: Array<{ id: string; filename: string; mimeType: string }>;
  }> {
    const formData = new FormData();
    formData.append("channelId", channelId);
    formData.append(
      "files",
      new Blob([new Uint8Array(fileBuffer)], { type: mimeType }),
      fileName
    );
    return this.request("POST", "/api/attachments/upload", formData);
  }
}
