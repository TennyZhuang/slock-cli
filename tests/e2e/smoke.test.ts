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

  it("unimplemented commands return JSON error", () => {
    const { stdout, exitCode } = run(
      ["messages", "send", "--target", "#general", "--content", "hi"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.message).toContain("Not implemented");
  });

  it("text format outputs to stderr on error", () => {
    const { stderr, exitCode } = run(
      ["--format", "text", "auth", "status"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    expect(stderr).toContain("Error:");
  });
});
