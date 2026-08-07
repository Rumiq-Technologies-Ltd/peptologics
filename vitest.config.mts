import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * Two projects rather than one, because the suites have genuinely different needs:
 * services, schemas and pure functions run in Node with no DOM at all, while component
 * tests need jsdom. Splitting them keeps the fast majority fast — spinning up jsdom for
 * a function that multiplies two integers is pure overhead.
 *
 * Playwright specs live in `e2e/` and are deliberately outside both `include` globs.
 * Running them under Vitest would start a browser inside a unit-test run.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` alias in tsconfig.json. Vitest does not read tsconfig paths.
      "@": path.resolve(import.meta.dirname, "src"),

      /*
       * `server-only` resolves to a module that throws on import — that is its entire
       * purpose, and it is what makes importing a service from a Client Component a
       * build error. Vitest resolves the same condition, so every service under test
       * would throw before an assertion ran. The guard stays fully active in the real
       * build; only the test run sees the stub.
       */
      "server-only": path.resolve(import.meta.dirname, "src/test/stubs/server-only.ts"),
    },
  },

  /*
   * tsconfig sets `jsx: "preserve"` because Next runs its own transform. Vitest has no
   * such step, so TSX would reach the runtime untransformed. Vitest 4 transforms with
   * oxc rather than esbuild, hence this key.
   */
  oxc: { jsx: { runtime: "automatic" } },

  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      /*
       * Only what these tests are meant to cover. Coverage over UI wrappers and route
       * files would inflate the number without adding confidence, which is the trap
       * CLAUDE.md warns about: coverage should support confidence, not become the goal.
       */
      include: [
        "src/features/**/services/**",
        "src/features/**/utils/**",
        "src/lib/validations/**",
        "src/lib/resilience/**",
        "src/lib/security/sanitize.ts",
        "src/services/notification.service.ts",
        "src/utils/**",
      ],
      /*
       * Repositories are excluded on purpose. They contain no decisions — each is a
       * shaped Supabase call — so a unit test would assert that a mocked query builder
       * was called the way the mock was written, which proves nothing. Their real
       * behaviour (RLS, grants, the atomic RPC) was verified against the live database
       * in Phases 1, 2 and 5, and that is the only place it *can* be verified.
       */
      exclude: ["**/*.repository.ts"],
    },
  },
});
