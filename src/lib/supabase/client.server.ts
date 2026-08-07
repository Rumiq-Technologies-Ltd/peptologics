import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * The two Supabase clients. Both are server-only — the browser never talks to
 * Supabase, which is why neither key is prefixed `NEXT_PUBLIC_`.
 *
 * Splitting read from write is the point of this module. The read client holds
 * only the publishable key and is subject to RLS, so a bug in a read path cannot
 * expose customer PII. The write client bypasses RLS and is reachable from
 * exactly one place: the inquiry write path, via the composition root.
 */

type TypedClient = SupabaseClient<Database>;

/**
 * Shared options. Auth is fully disabled: there are no user sessions, so token
 * refresh and session persistence are pure overhead, and persistence in a
 * serverless environment would try to write to storage that does not exist.
 */
const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * Module-scoped singletons.
 *
 * A Vercel function instance handles many requests under Fluid Compute, so
 * building a client per request would waste the connection pool for no benefit.
 * Neither client carries per-request state, so sharing them is safe.
 */
let readClient: TypedClient | undefined;
let writeClient: TypedClient | undefined;

/**
 * Read client. Uses the publishable key, so every query is filtered by RLS —
 * `products` is visible, everything else is denied outright.
 *
 * Use this for the catalog and anything else a visitor is allowed to see.
 */
export function getReadClient(): TypedClient {
  readClient ??= createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, clientOptions);
  return readClient;
}

/**
 * Write client. Uses the service-role key and **bypasses RLS entirely**.
 *
 * Only the inquiry write path should reach this. Do not use it for reads that a
 * visitor triggers — that would silently discard the RLS safety net.
 */
export function getWriteClient(): TypedClient {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    // Deliberately explicit rather than a generic "undefined" crash. This is the
    // error a developer hits when they first try to submit an inquiry locally
    // without having pasted the key, so it should say exactly what to do.
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set, so the write path is unavailable. " +
        "Add it to .env.local (Supabase Dashboard -> Project Settings -> API -> service_role). " +
        "It is optional in development but required in production.",
    );
  }

  writeClient ??= createClient<Database>(env.SUPABASE_URL, serviceRoleKey, clientOptions);
  return writeClient;
}

/** Whether the write path is usable. Lets callers degrade instead of throwing. */
export function isWriteClientAvailable(): boolean {
  return Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
}
