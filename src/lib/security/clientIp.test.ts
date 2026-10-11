import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/security/clientIp";

/**
 * The rate limiter keys on this address. A visitor who controls it controls their bucket,
 * so these cases are the rate limit's whole defence against header games (ADR-028).
 */

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://peptologics.example/api/inquiries", { method: "POST", headers });
}

describe("getClientIp", () => {
  it("uses the right-most x-forwarded-for entry, the one our edge appended", () => {
    // The visitor sent a spoofed address; the platform appended the real one.
    const request = requestWith({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" });

    expect(getClientIp(request)).toBe("198.51.100.7");
  });

  it("gives the same key however many spoofed addresses the visitor prepends", () => {
    const spoofed = requestWith({ "x-forwarded-for": "10.0.0.1, 198.51.100.7" });
    const spoofedAgain = requestWith({ "x-forwarded-for": "10.0.0.2, 10.0.0.3, 198.51.100.7" });

    expect(getClientIp(spoofedAgain)).toBe(getClientIp(spoofed));
  });

  it("returns the only entry when there is just one", () => {
    expect(getClientIp(requestWith({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip when no forwarded header is present", () => {
    expect(getClientIp(requestWith({ "x-real-ip": " 198.51.100.8 " }))).toBe("198.51.100.8");
  });

  it("returns unknown when neither header is present", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});
