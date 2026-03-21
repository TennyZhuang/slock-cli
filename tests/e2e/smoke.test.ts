/**
 * E2E smoke test — spawns the actual `slock` CLI binary.
 *
 * Tests basic command structure and output format.
 * Does NOT require a running server (tests help, version, error paths).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";

const CLI = path.resolve("dist/index.js");

function run(
  args: string[],
  opts?: { expectFail?: boolean; env?: Record<string, string> }
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf-8",
      env: { ...process.env, HOME: "/tmp/slock-cli-e2e-test", ...opts?.env },
      timeout: 5000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    if (opts?.expectFail) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        exitCode: err.status ?? 1,
      };
    }
    throw err;
  }
}

describe("E2E smoke tests", () => {
  beforeAll(() => {
    // Ensure the binary is built
    execFileSync("pnpm", ["build"], { cwd: path.resolve("."), timeout: 30000 });
  });

  it("shows help", () => {
    const { stdout, exitCode } = run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("CLI client for Slock platform");
    expect(stdout).toContain("auth");
    expect(stdout).toContain("messages");
    expect(stdout).toContain("tasks");
  });

  it("shows version", () => {
    const { stdout, exitCode } = run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("0.1.0");
  });

  it("shows auth subcommand help", () => {
    const { stdout, exitCode } = run(["auth", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("login");
    expect(stdout).toContain("logout");
    expect(stdout).toContain("status");
  });

  it("auth status returns JSON error when not logged in", () => {
    const { stdout, exitCode } = run(["auth", "status"], { expectFail: true });
    expect(exitCode).toBe(4); // AUTH_FAILED
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("auth login without --server-url defaults to hosted server", () => {
    const { stdout, exitCode } = run(
      ["auth", "login", "--email", "test@test.com", "--password", "test"],
      { expectFail: true }
    );
    // Should attempt connection to default hosted server, not fail with INVALID_ARGS
    expect(exitCode).toBeGreaterThan(0);
    expect(stdout).not.toContain("INVALID_ARGS");
    // Proves the default URL was used (appears in network error or auth error message)
    expect(stdout).toContain("api.slock.ai");
  });

  it("auth login fails with network error for unreachable server", () => {
    const { stdout, exitCode } = run(
      [
        "auth",
        "login",
        "--email",
        "test@test.com",
        "--password",
        "test",
        "--server-url",
        "http://localhost:1",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBeGreaterThan(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
  });

  it("implemented commands require auth when not logged in", () => {
    const { stdout, exitCode } = run(
      ["messages", "send", "--target", "#general", "--content", "hi"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4); // AUTH_FAILED
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("attachments upload validates file existence", () => {
    const { stdout, exitCode } = run(
      ["attachments", "upload", "--target", "#general", "--file", "/tmp/nonexistent-file-xyz.png"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("File not found");
  });

  it("text format outputs to stderr on error", () => {
    const { stderr, exitCode } = run(
      ["--format", "text", "auth", "status"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    expect(stderr).toContain("Error:");
  });

  // ── Phase 2 command smoke tests ─────────────────────

  it("shows messages subcommand help", () => {
    const { stdout, exitCode } = run(["messages", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("send");
    expect(stdout).toContain("read");
    expect(stdout).toContain("wait");
  });

  it("shows channels subcommand help", () => {
    const { stdout, exitCode } = run(["channels", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("join");
    expect(stdout).toContain("create");
  });

  it("messages read requires auth", () => {
    const { stdout, exitCode } = run(
      ["messages", "read", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels list requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "list"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("server info requires auth", () => {
    const { stdout, exitCode } = run(
      ["server", "info"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("messages send rejects invalid target", () => {
    const { stdout, exitCode } = run(
      ["messages", "send", "--target", "invalid", "--content", "hi"],
      { expectFail: true }
    );
    expect(exitCode).toBeGreaterThan(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    // Target parsing happens before auth, so error code is INVALID_ARGS
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("shows tasks subcommand help", () => {
    const { stdout, exitCode } = run(["tasks", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("create");
    expect(stdout).toContain("claim");
    expect(stdout).toContain("unclaim");
    expect(stdout).toContain("update");
  });

  it("tasks list requires auth", () => {
    const { stdout, exitCode } = run(
      ["tasks", "list", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("tasks update validates status", () => {
    const { stdout, exitCode } = run(
      ["tasks", "update", "--target", "#general", "--number", "1", "--status", "bogus"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("attachments upload rejects unsupported file type", () => {
    // Create a temp file with unsupported extension
    const tmpFile = "/tmp/slock-cli-test-file.txt";
    require("node:fs").writeFileSync(tmpFile, "test");
    try {
      const { stdout, exitCode } = run(
        ["attachments", "upload", "--target", "#general", "--file", tmpFile],
        { expectFail: true }
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(stdout);
      expect(parsed.ok).toBe(false);
      expect(parsed.error.code).toBe("INVALID_ARGS");
      expect(parsed.error.message).toContain("Unsupported file type");
    } finally {
      require("node:fs").unlinkSync(tmpFile);
    }
  });

  it("attachments download requires auth", () => {
    const { stdout, exitCode } = run(
      ["attachments", "download", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });
});
