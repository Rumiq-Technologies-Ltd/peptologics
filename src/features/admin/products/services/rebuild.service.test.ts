import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import {
  REBUILD_DEBOUNCE_MS,
  createRebuildService,
  type RebuildStore,
} from "@/features/admin/products/services/rebuild.service";
import { logger } from "@/lib/logger";

const HOOK = "https://webhooks.example.com/secret-token-123";
const T0 = new Date("2026-11-28T12:00:00.000Z");

function memoryStore() {
  const state = { last: null as string | null, pending: false };
  const store: RebuildStore = {
    getState: async () => ({ lastTriggeredAt: state.last, pending: state.pending }),
    claim: async (nowIso, cutoffIso) => {
      if (state.last !== null && state.last >= cutoffIso) return false;
      state.last = nowIso;
      state.pending = false;
      return true;
    },
    markPending: async () => {
      state.pending = true;
    },
    release: async () => {
      state.last = new Date(0).toISOString();
    },
  };
  return { state, store };
}

describe("rebuild service", () => {
  it("does nothing, and says so, without a webhook (local development)", async () => {
    const fetchImpl = vi.fn();
    const service = createRebuildService({
      store: memoryStore().store,
      hookUrl: undefined,
      fetchImpl,
      now: () => T0,
    });

    expect(await service.request("product_created")).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("rebuild_skipped_no_hook", {
      reason: "product_created",
    });
  });

  it("calls the hook once and records the time", async () => {
    const { store, state } = memoryStore();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const service = createRebuildService({ store, hookUrl: HOOK, fetchImpl, now: () => T0 });

    expect(await service.request("product_created")).toBe("triggered");

    expect(fetchImpl).toHaveBeenCalledWith(HOOK, expect.objectContaining({ method: "POST" }));
    expect(state.last).toBe(T0.toISOString());
    expect(state.pending).toBe(false);
  });

  it("covers several creates in a row with one build, and remembers the rest are owed", async () => {
    const { store, state } = memoryStore();
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    let clock = T0.getTime();
    const service = createRebuildService({
      store,
      hookUrl: HOOK,
      fetchImpl,
      now: () => new Date(clock),
    });

    expect(await service.request("a")).toBe("triggered");
    clock += 30_000;
    expect(await service.request("b")).toBe("deferred");
    clock += 30_000;
    expect(await service.request("c")).toBe("deferred");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(state.pending).toBe(true);

    // After the window, the next request starts the one build that covers b and c.
    clock += REBUILD_DEBOUNCE_MS;
    expect(await service.request("d")).toBe("triggered");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(state.pending).toBe(false);
  });

  it("reports a failed call without throwing, keeps a build owed and unblocks a retry", async () => {
    const { store, state } = memoryStore();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const service = createRebuildService({ store, hookUrl: HOOK, fetchImpl, now: () => T0 });

    expect(await service.request("product_created")).toBe("failed");
    expect(state.pending).toBe(true);

    // The window was released, so an immediate retry is allowed.
    expect(await service.request("manual")).toBe("triggered");
  });

  it("treats a network error the same way", async () => {
    const { store } = memoryStore();
    const service = createRebuildService({
      store,
      hookUrl: HOOK,
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      now: () => T0,
    });

    expect(await service.request("x")).toBe("failed");
  });

  it("never writes the webhook address to the logs", async () => {
    const { store } = memoryStore();
    const service = createRebuildService({
      store,
      hookUrl: HOOK,
      fetchImpl: vi.fn().mockRejectedValue(new Error(`failed to reach ${HOOK}`)),
      now: () => T0,
    });

    await service.request("x");

    const logged = JSON.stringify([
      vi.mocked(logger.error).mock.calls,
      vi.mocked(logger.info).mock.calls,
    ]);
    expect(logged).not.toContain("secret-token-123");
    expect(logged).not.toContain("webhooks.example.com");
  });
});
