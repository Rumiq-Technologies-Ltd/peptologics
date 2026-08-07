import { RUO_ACKNOWLEDGEMENT_DAYS, RUO_STORAGE_KEY, RUO_STORAGE_VERSION } from "@/constants/site";

/**
 * The Research-Use-Only acknowledgement, modelled as an external store.
 *
 * Kept apart from the component for two reasons: the pre-paint inline script and
 * the React component must agree on the storage format by construction rather
 * than by comment, and localStorage is genuinely an external store — so the gate
 * reads it through `useSyncExternalStore` rather than assigning state inside an
 * effect. That is both the idiomatic pattern and the one that survives React's
 * cascading-render lint rule.
 *
 * localStorage rather than a cookie, deliberately: a cookie read in the root
 * layout would make every route dynamic, and crawlers carry no cookie, so they
 * would always get the un-accepted branch. See ADR-009.
 */

interface StoredAcknowledgement {
  /** Schema version, so a future change can invalidate old records safely. */
  v: number;
  /** Epoch milliseconds when the visitor accepted. */
  at: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whether a valid, unexpired acknowledgement exists on this device.
 *
 * Every failure path returns false — a corrupt record, a disabled storage API, or
 * a private-browsing quota error all mean "not acknowledged", which is the safe
 * direction to fail.
 */
export function hasValidAcknowledgement(): boolean {
  try {
    const raw = window.localStorage.getItem(RUO_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as Partial<StoredAcknowledgement>;

    if (parsed.v !== RUO_STORAGE_VERSION) return false;
    if (typeof parsed.at !== "number" || !Number.isFinite(parsed.at)) return false;

    const ageMs = Date.now() - parsed.at;

    // A negative age means a clock change or a tampered record. Re-prompt.
    if (ageMs < 0) return false;

    return ageMs < RUO_ACKNOWLEDGEMENT_DAYS * MS_PER_DAY;
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------------------
 * External store plumbing for useSyncExternalStore.
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribes to acknowledgement changes.
 *
 * Also listens for the `storage` event, which fires in *other* tabs when this
 * origin's localStorage changes. That means accepting in one tab releases the gate
 * in every other open tab — the alternative is a visitor with three tabs open
 * having to accept three times.
 */
export function subscribeToAcknowledgement(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Client snapshot. Returns a boolean, so referential stability is automatic and
 * React will not loop.
 */
export function getAcknowledgementSnapshot(): boolean {
  return hasValidAcknowledgement();
}

/**
 * Server snapshot: always false, so the gate is present in the server-rendered
 * HTML and blocks content from the first painted frame rather than appearing after
 * hydration. The pre-paint script hides it for returning visitors before the
 * browser composites anything.
 */
export function getServerAcknowledgementSnapshot(): boolean {
  return false;
}

/** Records acceptance. Silently tolerates storage being unavailable. */
export function recordAcknowledgement(): void {
  try {
    const record: StoredAcknowledgement = { v: RUO_STORAGE_VERSION, at: Date.now() };
    window.localStorage.setItem(RUO_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private browsing or a full quota. The visitor still gets in for this
    // session; they will simply be asked again next time.
  }

  // Set regardless of whether persistence succeeded, so the CSS rule that hides
  // the gate applies immediately either way.
  document.documentElement.setAttribute("data-ruo", "ok");

  notifyListeners();
}
