import { COMPLIANCE_NOTICE } from "@/constants/site";

/**
 * The compliance line, at the very top of every page.
 *
 * Promoting the poster's small print to the first 32 pixels of the site does two
 * things: it satisfies the research-use-only disclosure requirement on every page
 * at once rather than relying on each page to remember, and it sets the register
 * before the visitor reads anything else.
 *
 * A Server Component with no interactivity, so it costs nothing at runtime.
 */
export function ComplianceStrip() {
  return (
    <div className="bg-ink-950 text-ink-300">
      <p className="h-strip text-tagline flex items-center justify-center px-4 text-center uppercase">
        {COMPLIANCE_NOTICE}
      </p>
    </div>
  );
}
