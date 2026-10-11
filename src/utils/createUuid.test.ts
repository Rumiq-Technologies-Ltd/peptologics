import { afterEach, describe, expect, it, vi } from "vitest";

import { createUuid } from "@/utils/createUuid";

/** RFC 4122 version 4: version nibble 4, variant bits 10xx. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createUuid", () => {
  it("returns a version 4 UUID where crypto.randomUUID is available", () => {
    expect(createUuid()).toMatch(UUID_V4);
  });

  it("builds a version 4 UUID from getRandomValues when randomUUID is missing", () => {
    // Older mobile browsers and plain-HTTP origins: randomUUID is absent or throws there.
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", { getRandomValues: real.getRandomValues.bind(real) });

    const ids = Array.from({ length: 50 }, () => createUuid());

    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
