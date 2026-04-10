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

  async listServerMembers(): Promise<
    Array<{ id: string; name: string; role: string }>
  > {
    const config = this.serverId;
    return this.request("GET", `/api/servers/${config}/members`);
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
