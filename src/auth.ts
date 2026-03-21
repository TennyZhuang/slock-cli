/**
 * auth.ts — Token management and automatic refresh.
 *
 * Handles JWT access token validation (client-side exp check),
 * automatic refresh when expired, and credential persistence.
 */

import { getProfile, saveProfile, deleteProfile, resolveConfig } from "./config.js";
import { fail } from "./output.js";

/**
 * Decode JWT payload without verification (client-side exp check only).
 */
function decodeJwtPayload(token: string): { sub: string; exp: number; type: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
  return JSON.parse(payload);
}

/**
 * Check if an access token is expired or about to expire (within 60s buffer).
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    const nowSec = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSec + 60; // 60s buffer
  } catch {
    return true; // If we can't decode, treat as expired
  }
}

/**
 * Refresh the access token using the refresh token.
 * Updates the profile on disk.
 * Returns the new access token.
 */
export async function refreshAccessToken(
  serverUrl: string,
  refreshToken: string,
  profileName: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${serverUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    // Refresh failed — clear tokens
    deleteProfile(profileName);
    fail("AUTH_EXPIRED", "Session expired. Please run `slock auth login` again.");
  }

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  // Update profile with new tokens
  const profile = getProfile(profileName);
  if (profile) {
    saveProfile(profileName, {
      ...profile,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
  }

  return data;
}

/**
 * Ensure we have a valid access token, refreshing if needed.
 * Returns the access token ready for use.
 */
export async function ensureValidToken(opts?: {
  profile?: string;
  serverUrl?: string;
}): Promise<{ accessToken: string; serverUrl: string; serverId: string }> {
  const config = resolveConfig(opts);

  if (!config.serverUrl) {
    fail("AUTH_FAILED", "No server URL configured. Run `slock auth login` first.");
  }
  if (!config.serverId) {
    fail("AUTH_FAILED", "No server ID configured. Run `slock auth login` first.");
  }
  if (!config.accessToken || !config.refreshToken) {
    fail("AUTH_FAILED", "Not logged in. Run `slock auth login` first.");
  }

  let accessToken = config.accessToken;

  if (isTokenExpired(accessToken)) {
    const refreshed = await refreshAccessToken(
      config.serverUrl,
      config.refreshToken,
      config.profileName
    );
    accessToken = refreshed.accessToken;
  }

  return {
    accessToken,
    serverUrl: config.serverUrl,
    serverId: config.serverId,
  };
}

/**
 * Login to a slock server.
 * Returns user info and saves credentials to profile.
 */
export async function login(
  serverUrl: string,
  email: string,
  password: string,
  profileName: string
): Promise<{
  user: { id: string; name: string; email: string };
  serverId: string;
}> {
  // Step 1: Login
  const loginRes = await fetch(`${serverUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const body = (await loginRes.json().catch(() => ({}))) as { error?: string };
    fail(
      "AUTH_FAILED",
      body.error ?? `Login failed (HTTP ${loginRes.status})`
    );
  }

  const loginData = (await loginRes.json()) as {
    user: { id: string; name: string; email: string };
    accessToken: string;
    refreshToken: string;
  };

  // Step 2: Get user's servers to find the server ID
  const serversRes = await fetch(`${serverUrl}/api/servers`, {
    headers: { Authorization: `Bearer ${loginData.accessToken}` },
  });

  if (!serversRes.ok) {
    fail("GENERAL_ERROR", "Failed to fetch server list after login");
  }

  const servers = (await serversRes.json()) as Array<{
    id: string;
    name: string;
    slug: string;
  }>;

  if (servers.length === 0) {
    fail("NOT_FOUND", "No servers found for this account");
  }

  // Use the first server (most accounts have one)
  const server = servers[0];

  // Save profile
  saveProfile(profileName, {
    serverUrl,
    serverId: server.id,
    accessToken: loginData.accessToken,
    refreshToken: loginData.refreshToken,
    userId: loginData.user.id,
  });

  return {
    user: loginData.user,
    serverId: server.id,
  };
}
