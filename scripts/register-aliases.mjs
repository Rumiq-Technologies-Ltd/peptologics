/**
 * Lets a script run with plain Node and still import application modules by their `@/`
 * alias, so a script and the app share one implementation instead of two copies.
 *
 * Node runs TypeScript natively but knows nothing about the `@/*` path alias in tsconfig.
 * This registers a resolve hook that maps `@/x` to `src/x.ts` (or `src/x/index.ts`) and
 * leaves every other specifier alone.
 *
 * Use it with `--import`:
 *
 *   node --import ./scripts/register-aliases.mjs scripts/coa.ts ...
 *
 * Only modules that are safe outside Next can be imported this way: nothing that imports
 * `server-only`, React, or `@/lib/env`.
 */

import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const srcDirectory = path.resolve(import.meta.dirname, "..", "src");

/** The file an aliased path points at, trying the extensions the app uses. */
function findSourceFile(basePath) {
  const candidates = [`${basePath}.ts`, `${basePath}.tsx`, path.join(basePath, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const file = findSourceFile(path.join(srcDirectory, specifier.slice(2)));
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }

    return nextResolve(specifier, context);
  },
});
