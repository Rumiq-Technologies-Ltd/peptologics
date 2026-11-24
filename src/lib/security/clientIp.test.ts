import { describe, expect, it } from "vitest";

import { getClientIp } from "@/lib/security/clientIp";

/**
 * The rate limiter keys on this address. A visitor who controls it controls their bucket,
 * so these cases are the rate limit's whole defence against header games (ADR-028).
 *
 * Behind Amplify, `x-forwarded-for` is `<visitor>, <CloudFront edge>`, so the visitor is
 * second from right.
 */

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://peptologics.example/api/inquiries", { method: "POST", headers });
}

describe("getClientIp", () => {
  describe("cloudfront-viewer-address", () => {
    it("strips the port from an IPv4 address", () => {
      const request = requestWith({ "cloudfront-viewer-address": "198.51.100.10:46532" });

      expect(getClientIp(request)).toBe("198.51.100.10");
    });

    it("strips the port from an unbracketed IPv6 address", () => {
      const request = requestWith({ "cloudfront-viewer-address": "2001:db8::1234:46532" });

      expect(getClientIp(request)).toBe("2001:db8::1234");
    });

    it("wins over x-forwarded-for", () => {
      const request = requestWith({
        "cloudfront-viewer-address": "198.51.100.10:46532",
        "x-forwarded-for": "203.0.113.5, 192.0.2.50",
      });

      expect(getClientIp(request)).toBe("198.51.100.10");
    });

    it.each(["not-an-ip:1234", "198.51.100.10", "999.1.1.1:80", ":80", ""])(
      "ignores the malformed value %j and falls back to x-forwarded-for",
      (value) => {
        const request = requestWith({
          "cloudfront-viewer-address": value,
          "x-forwarded-for": "203.0.113.5, 192.0.2.50",
        });

        expect(getClientIp(request)).toBe("203.0.113.5");
      },
    );

    // This test does not strip a client-sent viewer-address, so a forged value would be
    // used here. In production CloudFront overwrites the header on every request, so the
    // visitor cannot choose it while the app is reachable only through CloudFront.
    it("trusts the header as given, because CloudFront overwrites it in production", () => {
      const request = requestWith({ "cloudfront-viewer-address": "203.0.113.99:1" });

      expect(getClientIp(request)).toBe("203.0.113.99");
    });
  });

  describe("x-forwarded-for fallback", () => {
    it("uses the only entry when there is one", () => {
      expect(getClientIp(requestWith({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
    });

    it("uses the visitor, second from right, when CloudFront appended its edge", () => {
      const request = requestWith({ "x-forwarded-for": "198.51.100.7, 192.0.2.50" });

      expect(getClientIp(request)).toBe("198.51.100.7");
    });

    it("ignores client-sent entries on the left", () => {
      // The visitor sent 10.0.0.1; CloudFront recorded the visitor and then its own edge.
      const spoofed = requestWith({ "x-forwarded-for": "10.0.0.1, 198.51.100.7, 192.0.2.50" });
      const honest = requestWith({ "x-forwarded-for": "198.51.100.7, 192.0.2.50" });

      expect(getClientIp(spoofed)).toBe("198.51.100.7");
      expect(getClientIp(spoofed)).toBe(getClientIp(honest));
    });
  });

  it("falls back to x-real-ip when no forwarded header is present", () => {
    expect(getClientIp(requestWith({ "x-real-ip": " 198.51.100.8 " }))).toBe("198.51.100.8");
  });

  it("returns unknown when no usable header is present", () => {
    expect(getClientIp(requestWith({}))).toBe("unknown");
  });
});
