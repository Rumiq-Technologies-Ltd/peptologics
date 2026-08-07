/**
 * Test stub for the `server-only` package.
 *
 * The real package resolves to a module that throws on import, which is exactly its
 * job: it turns "this file reached a Client Component" into a build error. Vitest
 * resolves the same browser condition, so importing any service under test would throw
 * before a single assertion ran.
 *
 * Aliasing it to this empty module in `vitest.config.mts` keeps the guard fully active
 * in the real build — where it matters — while letting the tests import the services it
 * protects.
 */

export {};
