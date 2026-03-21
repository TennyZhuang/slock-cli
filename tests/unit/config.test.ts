/**
 * Unit tests for config.ts — file I/O with a temp directory.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getGlobalConfig,
  saveProfile,
  getProfile,
  deleteProfile,
  listProfiles,
} from "../../src/config.js";

let tempDir: string;
let origHome: string | undefined;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "slock-cli-test-"));
  origHome = process.env.HOME;
  process.env.HOME = tempDir;
});

afterEach(() => {
  if (origHome !== undefined) {
    process.env.HOME = origHome;
  } else {
    delete process.env.HOME;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("config", () => {
  it("returns default global config when none exists", () => {
    const config = getGlobalConfig();
    expect(config.activeProfile).toBe("default");
    expect(config.defaults.format).toBe("json");
  });

  it("saves and reads a profile", () => {
    const profile = {
      serverUrl: "http://localhost:3001",
      serverId: "server-123",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "user-456",
    };
    saveProfile("test", profile);
    const loaded = getProfile("test");
    expect(loaded).toEqual(profile);
  });

  it("returns null for non-existent profile", () => {
    expect(getProfile("nonexistent")).toBeNull();
  });

  it("deletes a profile", () => {
    saveProfile("temp", {
      serverUrl: "http://x",
      serverId: "s",
      accessToken: "a",
      refreshToken: "r",
      userId: "u",
    });
    expect(getProfile("temp")).not.toBeNull();
    deleteProfile("temp");
    expect(getProfile("temp")).toBeNull();
  });

  it("lists profiles", () => {
    saveProfile("alpha", {
      serverUrl: "http://x",
      serverId: "s",
      accessToken: "a",
      refreshToken: "r",
      userId: "u",
    });
    saveProfile("beta", {
      serverUrl: "http://y",
      serverId: "s2",
      accessToken: "a2",
      refreshToken: "r2",
      userId: "u2",
    });
    const profiles = listProfiles();
    expect(profiles).toContain("alpha");
    expect(profiles).toContain("beta");
  });

  it("sets profile file permissions to 0600", () => {
    saveProfile("secure", {
      serverUrl: "http://x",
      serverId: "s",
      accessToken: "secret",
      refreshToken: "secret",
      userId: "u",
    });
    const profilePath = path.join(
      tempDir,
      ".slock-cli",
      "profiles",
      "secure.json"
    );
    const stat = fs.statSync(profilePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
