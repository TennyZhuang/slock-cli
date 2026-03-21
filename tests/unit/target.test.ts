/**
 * Unit tests for target.ts — parseTarget (pure function).
 */

import { describe, it, expect } from "vitest";
import { parseTarget } from "../../src/target.js";

describe("parseTarget", () => {
  // ── Channel targets ─────────────────────────────────
  it("parses a simple channel target", () => {
    expect(parseTarget("#general")).toEqual({
      type: "channel",
      name: "general",
    });
  });

  it("parses a channel with hyphens", () => {
    expect(parseTarget("#slock-cli")).toEqual({
      type: "channel",
      name: "slock-cli",
    });
  });

  it("parses a channel with thread ID", () => {
    expect(parseTarget("#general:abc123")).toEqual({
      type: "channel",
      name: "general",
      threadId: "abc123",
    });
  });

  it("parses a channel with long thread ID", () => {
    expect(parseTarget("#dev:7f55a8d7-afc7-4c8e")).toEqual({
      type: "channel",
      name: "dev",
      threadId: "7f55a8d7-afc7-4c8e",
    });
  });

  // ── DM targets ──────────────────────────────────────
  it("parses a simple DM target", () => {
    expect(parseTarget("dm:@alice")).toEqual({
      type: "dm",
      peer: "alice",
    });
  });

  it("parses a DM with thread ID", () => {
    expect(parseTarget("dm:@bob:thread123")).toEqual({
      type: "dm",
      peer: "bob",
      threadId: "thread123",
    });
  });

  it("parses a DM with hyphenated peer name", () => {
    expect(parseTarget("dm:@MrCroxx")).toEqual({
      type: "dm",
      peer: "MrCroxx",
    });
  });

  // ── Error cases ─────────────────────────────────────
  it("throws on empty channel name", () => {
    expect(() => parseTarget("#")).toThrow("channel name cannot be empty");
  });

  it("throws on empty thread ID in channel", () => {
    expect(() => parseTarget("#general:")).toThrow("thread ID cannot be empty");
  });

  it("throws on empty peer name", () => {
    expect(() => parseTarget("dm:@")).toThrow("peer name cannot be empty");
  });

  it("throws on empty thread ID in DM", () => {
    expect(() => parseTarget("dm:@alice:")).toThrow("thread ID cannot be empty");
  });

  it("throws on invalid target format", () => {
    expect(() => parseTarget("random")).toThrow('must start with "#"');
  });

  it("throws on dm without @", () => {
    expect(() => parseTarget("dm:alice")).toThrow('must start with "#"');
  });
});
