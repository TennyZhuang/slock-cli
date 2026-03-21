/**
 * Unit tests for auth.ts — isTokenExpired (pure function).
 */

import { describe, it, expect } from "vitest";
import { isTokenExpired } from "../../src/auth.js";

/**
 * Create a minimal JWT with given exp (seconds since epoch).
 * No signature verification needed for client-side exp check.
 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesig`;
}

describe("isTokenExpired", () => {
  it("returns false for a token expiring far in the future", () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = makeJwt({ sub: "user1", exp: futureExp, type: "access" });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for a token that already expired", () => {
    const pastExp = Math.floor(Date.now() / 1000) - 100;
    const token = makeJwt({ sub: "user1", exp: pastExp, type: "access" });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for a token expiring within the 60s buffer", () => {
    const soonExp = Math.floor(Date.now() / 1000) + 30; // 30s from now, within 60s buffer
    const token = makeJwt({ sub: "user1", exp: soonExp, type: "access" });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for an invalid token", () => {
    expect(isTokenExpired("not-a-jwt")).toBe(true);
  });

  it("returns true for an empty string", () => {
    expect(isTokenExpired("")).toBe(true);
  });
});
