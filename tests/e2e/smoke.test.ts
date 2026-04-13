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
    expect(stdout).toContain("CLI client for the Slock collaboration platform");
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
    expect(stdout).toContain("get");
    expect(stdout).toContain("search");
  });

  it("messages get requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "messages",
        "get",
        "--id",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("messages search requires auth", () => {
    const { stdout, exitCode } = run(
      ["messages", "search", "--query", "needle"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("top-level search alias requires auth", () => {
    const { stdout, exitCode } = run(["search", "needle"], {
      expectFail: true,
    });
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("messages search rejects invalid --target before auth", () => {
    const { stdout, exitCode } = run(
      [
        "messages",
        "search",
        "--query",
        "needle",
        "--target",
        "invalid",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    // parseTarget runs before ensureValidToken in runSearch (matching
    // `messages send` ordering), so a malformed target is INVALID_ARGS
    // regardless of auth state.
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("shows channels subcommand help", () => {
    const { stdout, exitCode } = run(["channels", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("join");
    expect(stdout).toContain("create");
    expect(stdout).toContain("get");
    expect(stdout).toContain("delete");
    expect(stdout).toContain("leave");
    expect(stdout).toContain("read");
    expect(stdout).toContain("members");
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
    expect(stdout).toContain("delete");
    expect(stdout).toContain("convert-message");
  });

  it("tasks delete refuses without --yes", () => {
    const { stdout, exitCode } = run(
      ["tasks", "delete", "--target", "#general", "--number", "1"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--yes");
  });

  it("tasks delete with --yes requires auth", () => {
    const { stdout, exitCode } = run(
      ["tasks", "delete", "--target", "#general", "--number", "1", "--yes"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("tasks delete validates --number", () => {
    const { stdout, exitCode } = run(
      ["tasks", "delete", "--target", "#general", "--number", "abc", "--yes"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("tasks convert-message requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "tasks",
        "convert-message",
        "--message-id",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
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

  // ── PR-C: channels round-out smoke tests ────────────────

  it("channels get requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "get", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels get rejects invalid target", () => {
    const { stdout, exitCode } = run(
      ["channels", "get", "--target", "garbage"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("channels delete refuses without --yes", () => {
    const { stdout, exitCode } = run(
      ["channels", "delete", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--yes");
    expect(parsed.error.message).toContain("channels delete");
  });

  it("channels delete --yes gate runs before target validation", () => {
    // Even with a malformed target, the --yes gate should fire first.
    // This proves the destructive-confirmation diagnostic isn't drowned
    // out by other arg errors (mirrors the convention from tasks delete).
    const { stdout, exitCode } = run(
      ["channels", "delete", "--target", "garbage"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--yes");
  });

  it("channels delete with --yes requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "delete", "--target", "#general", "--yes"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels leave requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "leave", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels read requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "read", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels read validates --seq", () => {
    const { stdout, exitCode } = run(
      ["channels", "read", "--target", "#general", "--seq", "abc"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--seq");
  });

  it("shows channels members subcommand help", () => {
    const { stdout, exitCode } = run(["channels", "members", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("add");
    expect(stdout).toContain("remove");
  });

  it("channels members list requires auth", () => {
    const { stdout, exitCode } = run(
      ["channels", "members", "list", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels members add requires exactly one of --agent or --user", () => {
    // Neither flag → INVALID_ARGS
    const neither = run(
      ["channels", "members", "add", "--target", "#general"],
      { expectFail: true }
    );
    expect(neither.exitCode).toBe(1);
    expect(JSON.parse(neither.stdout).error.code).toBe("INVALID_ARGS");

    // Both flags → INVALID_ARGS
    const both = run(
      [
        "channels",
        "members",
        "add",
        "--target",
        "#general",
        "--agent",
        "00000000-0000-0000-0000-000000000000",
        "--user",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(both.exitCode).toBe(1);
    expect(JSON.parse(both.stdout).error.code).toBe("INVALID_ARGS");
  });

  it("channels members add with --agent requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "channels",
        "members",
        "add",
        "--target",
        "#general",
        "--agent",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("channels members remove requires exactly one of --agent or --user", () => {
    const { stdout, exitCode } = run(
      ["channels", "members", "remove", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("channels members remove with --agent requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "channels",
        "members",
        "remove",
        "--target",
        "#general",
        "--agent",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  // ── PR-D: threads command smoke tests ──────────────────

  it("shows threads subcommand help", () => {
    const { stdout, exitCode } = run(["threads", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("follow");
    expect(stdout).toContain("unfollow");
    expect(stdout).toContain("done");
    expect(stdout).toContain("undone");
  });

  it("threads list (followed mode) requires auth", () => {
    const { stdout, exitCode } = run(["threads", "list"], { expectFail: true });
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("threads list with --target requires auth", () => {
    const { stdout, exitCode } = run(
      ["threads", "list", "--target", "#general"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("threads list rejects malformed --target before auth", () => {
    const { stdout, exitCode } = run(
      ["threads", "list", "--target", "invalid"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    // parseTarget runs before ensureValidToken (matching the convention
    // from `messages send` / `messages search`), so a malformed target
    // is INVALID_ARGS regardless of auth state.
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("threads list rejects --target with thread segment", () => {
    // A thread-shaped target (e.g. #general:abc123) is meaningful for
    // `messages send` but nonsensical for `threads list` — you can't
    // list threads "inside" a thread. Caught at parse time, before auth.
    const { stdout, exitCode } = run(
      ["threads", "list", "--target", "#general:abc123"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("must be a channel");
  });

  it("threads follow requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "threads",
        "follow",
        "--message-id",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("threads follow requires --message-id", () => {
    const { stdout, exitCode } = run(["threads", "follow"], {
      expectFail: true,
    });
    // commander emits its own error (not the JSON envelope) on missing
    // required option, so just assert it failed and didn't go through
    // to the auth check.
    expect(exitCode).toBeGreaterThan(0);
    expect(stdout).not.toContain("AUTH_FAILED");
  });

  it("threads unfollow requires auth (with UUID --thread)", () => {
    const { stdout, exitCode } = run(
      [
        "threads",
        "unfollow",
        "--thread",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    // parseThreadSpec short-circuits on UUIDs without parsing as a
    // target, so the sync syntax check passes and we reach
    // ensureValidToken → AUTH_FAILED.
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("threads done requires auth (with UUID --thread)", () => {
    const { stdout, exitCode } = run(
      ["threads", "done", "--thread", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("threads undone requires auth (with UUID --thread)", () => {
    const { stdout, exitCode } = run(
      [
        "threads",
        "undone",
        "--thread",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  // Temporal-ordering regression coverage: malformed --thread must
  // report INVALID_ARGS regardless of auth state. Same convention as
  // `messages send` / `messages search` (PR-A `6543337`). The fix
  // splits resolveThread into a sync `parseThreadSpec` (runs before
  // ensureValidToken) and an async `resolveThreadSpec` (runs after).
  // Without the split, "garbage" would resolve as AUTH_FAILED first.

  it("threads unfollow rejects malformed --thread before auth", () => {
    const { stdout, exitCode } = run(
      ["threads", "unfollow", "--thread", "garbage"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("threads done rejects malformed --thread before auth", () => {
    const { stdout, exitCode } = run(
      ["threads", "done", "--thread", "garbage"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("threads undone rejects malformed --thread before auth", () => {
    const { stdout, exitCode } = run(
      ["threads", "undone", "--thread", "garbage"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  // ── PR-E: agents command smoke tests ───────────────────

  it("shows agents subcommand help", () => {
    const { stdout, exitCode } = run(["agents", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("get");
    expect(stdout).toContain("create");
    expect(stdout).toContain("update");
    expect(stdout).toContain("delete");
    expect(stdout).toContain("start");
    expect(stdout).toContain("stop");
    expect(stdout).toContain("reset");
    expect(stdout).toContain("assign-machine");
  });

  it("agents list requires auth", () => {
    const { stdout, exitCode } = run(["agents", "list"], { expectFail: true });
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents get requires auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "get", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents create requires auth with valid args", () => {
    const { stdout, exitCode } = run(
      ["agents", "create", "--name", "test-agent"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents create rejects malformed --env before auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "create", "--name", "test-agent", "--env", "no_equals_sign"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--env");
  });

  it("agents create rejects --env with empty key before auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "create", "--name", "test-agent", "--env", "=value"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("agents create rejects invalid --reasoning-effort before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "create",
        "--name",
        "test-agent",
        "--reasoning-effort",
        "bogus",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--reasoning-effort");
  });

  it("agents update refuses empty PATCH body before auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "update", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("at least one field");
  });

  it("agents update rejects --model null before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "update",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--model",
        "null",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--model");
  });

  it("agents update rejects invalid --reasoning-effort before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "update",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--reasoning-effort",
        "bogus",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("agents update rejects --clear-env combined with --env before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "update",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--clear-env",
        "--env",
        "FOO=bar",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--clear-env");
  });

  it("agents update with --display-name requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "update",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--display-name",
        "New Name",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents delete refuses without --yes", () => {
    const { stdout, exitCode } = run(
      ["agents", "delete", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--yes");
    expect(parsed.error.message).toContain("agents delete");
  });

  it("agents delete with --yes requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "delete",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--yes",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents start requires auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "start", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents stop requires auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "stop", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents reset (default mode) requires auth", () => {
    const { stdout, exitCode } = run(
      ["agents", "reset", "--id", "00000000-0000-0000-0000-000000000000"],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents reset rejects invalid --mode before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "reset",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--mode",
        "bogus",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--mode");
  });

  it("agents reset --mode full refuses without --yes before auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "reset",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--mode",
        "full",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
    expect(parsed.error.message).toContain("--yes");
  });

  it("agents reset --mode full with --yes requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "reset",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--mode",
        "full",
        "--yes",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents reset --mode session does NOT require --yes (recoverable)", () => {
    // session reset clears sessionId but leaves the workspace intact, so
    // the destructive --yes gate should NOT fire — should pass straight
    // through to auth.
    const { stdout, exitCode } = run(
      [
        "agents",
        "reset",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--mode",
        "session",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  it("agents assign-machine requires auth", () => {
    const { stdout, exitCode } = run(
      [
        "agents",
        "assign-machine",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--machine",
        "00000000-0000-0000-0000-000000000000",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });

  // ── profile command group ────────────────────────────

  it("shows profile subcommand help", () => {
    const { stdout, exitCode } = run(["profile", "--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("list");
    expect(stdout).toContain("current");
    expect(stdout).toContain("use");
    expect(stdout).toContain("remove");
  });

  it("profile list returns empty array when no profiles exist", () => {
    const { stdout, exitCode } = run(["profile", "list"], {
      env: { HOME: "/tmp/slock-cli-e2e-test-empty-profiles" },
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.data.profiles).toEqual([]);
    expect(parsed.data.activeProfile).toBe("default");
  });

  it("profile current fails NOT_FOUND when active profile is missing", () => {
    const { stdout, exitCode } = run(["profile", "current"], {
      expectFail: true,
      env: { HOME: "/tmp/slock-cli-e2e-test-empty-profiles" },
    });
    expect(exitCode).toBe(2); // NOT_FOUND
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("NOT_FOUND");
  });

  it("profile use refuses to switch to a non-existent profile", () => {
    const { stdout, exitCode } = run(["profile", "use", "ghost"], {
      expectFail: true,
      env: { HOME: "/tmp/slock-cli-e2e-test-empty-profiles" },
    });
    expect(exitCode).toBe(2); // NOT_FOUND
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("NOT_FOUND");
  });

  it("profile remove without --yes fails INVALID_ARGS", () => {
    // Destructive-action gate runs FIRST per `tasks/delete.ts` /
    // `agents/delete.ts` convention — even before the existence check.
    const { stdout, exitCode } = run(["profile", "remove", "anything"], {
      expectFail: true,
      env: { HOME: "/tmp/slock-cli-e2e-test-empty-profiles" },
    });
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("INVALID_ARGS");
  });

  it("profile remove --yes still fails NOT_FOUND for missing profile", () => {
    const { stdout, exitCode } = run(
      ["profile", "remove", "ghost", "--yes"],
      {
        expectFail: true,
        env: { HOME: "/tmp/slock-cli-e2e-test-empty-profiles" },
      }
    );
    expect(exitCode).toBe(2);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("NOT_FOUND");
  });

  it("agents assign-machine accepts literal 'null' to unassign", () => {
    // The literal string "null" should NOT be treated as a name lookup;
    // it short-circuits to JSON null and only the auth check trips.
    const { stdout, exitCode } = run(
      [
        "agents",
        "assign-machine",
        "--id",
        "00000000-0000-0000-0000-000000000000",
        "--machine",
        "null",
      ],
      { expectFail: true }
    );
    expect(exitCode).toBe(4);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.error.code).toBe("AUTH_FAILED");
  });
});
