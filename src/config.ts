/**
 * config.ts — Profile and configuration management.
 *
 * Config directory: ~/.slock-cli/
 *   config.json        — global config (active profile, defaults)
 *   profiles/<name>.json — per-profile credentials and server info
 *
 * Priority (high → low): CLI flags → env vars → active profile → defaults
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getConfigDir(): string {
  return path.join(os.homedir(), ".slock-cli");
}
function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}
function getProfilesDir(): string {
  return path.join(getConfigDir(), "profiles");
}

export interface GlobalConfig {
  activeProfile: string;
  defaults: {
    format: "json" | "text";
  };
}

export interface Profile {
  serverUrl: string;
  serverId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

function ensureConfigDir(): void {
  fs.mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
  fs.mkdirSync(getProfilesDir(), { recursive: true, mode: 0o700 });
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureConfigDir();
  const content = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

export function getGlobalConfig(): GlobalConfig {
  const config = readJsonFile<GlobalConfig>(getConfigFile());
  return config ?? { activeProfile: "default", defaults: { format: "json" } };
}

export function saveGlobalConfig(config: GlobalConfig): void {
  writeJsonFile(getConfigFile(), config);
}

function profilePath(name: string): string {
  return path.join(getProfilesDir(), `${name}.json`);
}

export function getProfile(name?: string): Profile | null {
  const profileName = name ?? getGlobalConfig().activeProfile;
  return readJsonFile<Profile>(profilePath(profileName));
}

export function saveProfile(name: string, profile: Profile): void {
  writeJsonFile(profilePath(name), profile);
}

export function deleteProfile(name: string): void {
  const p = profilePath(name);
  try {
    fs.unlinkSync(p);
  } catch {
    // File may not exist — ignore
  }
}

export function listProfiles(): string[] {
  try {
    return fs
      .readdirSync(getProfilesDir())
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

/**
 * Resolve effective configuration from CLI flags, env vars, and profile.
 * Returns null fields if not resolvable.
 */
export interface ResolvedConfig {
  serverUrl: string | null;
  serverId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  profileName: string;
}

export function resolveConfig(opts?: {
  serverUrl?: string;
  serverId?: string;
  profile?: string;
}): ResolvedConfig {
  const globalConfig = getGlobalConfig();
  const profileName = opts?.profile ?? globalConfig.activeProfile;
  const profile = getProfile(profileName);

  return {
    serverUrl:
      opts?.serverUrl ?? process.env.SLOCK_SERVER_URL ?? profile?.serverUrl ?? null,
    serverId:
      opts?.serverId ?? process.env.SLOCK_SERVER_ID ?? profile?.serverId ?? null,
    accessToken: process.env.SLOCK_ACCESS_TOKEN ?? profile?.accessToken ?? null,
    refreshToken: process.env.SLOCK_REFRESH_TOKEN ?? profile?.refreshToken ?? null,
    userId: profile?.userId ?? null,
    profileName,
  };
}
