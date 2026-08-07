import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Setup for the jsdom project only.
 *
 * `jest-dom/vitest` registers the DOM matchers (`toBeDisabled`,
 * `toHaveAccessibleName` and friends) against Vitest's `expect`. Those matchers are
 * what let a component test assert on what a user or a screen reader perceives rather
 * than on internal state.
 *
 * `cleanup` is registered by hand because Testing Library only auto-registers it when
 * Vitest runs with `globals: true`, and this project does not — imports are explicit
 * everywhere else, so they are explicit here too. Without it, each render stacks
 * another copy of the component in the same document and queries start reporting
 * "multiple elements found" from the *previous* test.
 */
afterEach(cleanup);
