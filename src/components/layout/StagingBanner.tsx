import { TriangleAlertIcon } from "lucide-react";

import { STAGING_BANNER_TEXT } from "@/constants/messages";

/**
 * A "this is not the live site" notice, shown only on the staging deployment (D40).
 *
 * Staging looks exactly like production but has email off on purpose, so a tester who
 * submits the quote form there sees a success page and never receives an email. The
 * banner makes the difference impossible to miss.
 *
 * `appEnv` is a prop, not read here, so the rule is testable and the component stays a
 * pure Server Component: no client JavaScript, no new environment variable. Outside
 * staging it renders nothing, so production ships no extra markup. Not dismissible, on
 * purpose. `role="status"` because it is information, not an alert that interrupts.
 */
export function StagingBanner({ appEnv }: { appEnv: string | undefined }) {
  if (appEnv !== "staging") return null;

  return (
    <div
      role="status"
      className="bg-warning-bg text-ink-950 border-warning/40 border-b px-4 py-2 text-center text-sm font-medium"
    >
      <TriangleAlertIcon
        className="text-warning mr-2 inline size-4 align-text-bottom"
        aria-hidden="true"
      />
      {STAGING_BANNER_TEXT}
    </div>
  );
}
