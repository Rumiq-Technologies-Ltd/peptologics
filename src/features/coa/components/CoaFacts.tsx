import { ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/features/coa/components/CopyButton";
import type { CoaReport } from "@/features/coa/constants/coaReports";
import { COA_LABS, COA_LOOKUP_INSTRUCTION } from "@/features/coa/constants/labs";
import { cn } from "@/utils/cn";

/**
 * "Verify with lab": a link to the lab's own record, in a new tab.
 *
 * Used in the dialog header (beside the close button) and inside a facts strip. On a narrow
 * screen it collapses to the shield icon and the word "Verify"; the accessible name stays
 * the full "Verify with lab, <lab>, opens in a new tab" either way.
 */
export interface VerifyWithLabLinkProps {
  report: CoaReport;
  className?: string;
}

export function VerifyWithLabLink({ report, className }: VerifyWithLabLinkProps) {
  const { verification } = report;
  if (!verification) return null;

  const lab = COA_LABS[verification.labId];

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn("min-h-11 shrink-0 sm:min-h-9", className)}
    >
      <a href={lab.verifyUrl(verification.reportId)} target="_blank" rel="noopener noreferrer">
        <ShieldCheckIcon aria-hidden="true" />
        <span aria-hidden="true" className="sm:hidden">
          Verify
        </span>
        <span aria-hidden="true" className="hidden sm:inline">
          Verify with lab
        </span>
        <ExternalLinkIcon aria-hidden="true" className="hidden sm:block" />
        <span className="sr-only">Verify with lab, {lab.shortName}, opens in a new tab</span>
      </a>
    </Button>
  );
}

/**
 * The facts about one laboratory report: who issued it, the lot and purity, and the code to
 * look it up by. Sits above any scan, so the customer sees it without scrolling past the
 * certificate.
 *
 * The site publishes a copy (or only a pointer); the laboratory's own record is the
 * authority, and fraudulent certificates that borrow a lab's name are in circulation. So the
 * code is always on screen, one click from the clipboard. A report with no verification
 * (an other-company report) shows the lot and purity only, if known.
 */
export interface CoaFactsProps {
  report: CoaReport;
  /**
   * Show a "Verify with lab" button inside the strip. Off when the dialog header already
   * carries the one button for this view.
   */
  showVerify: boolean;
}

export function CoaFacts({ report, showVerify }: CoaFactsProps) {
  const { verification } = report;
  const lab = verification ? COA_LABS[verification.labId] : null;

  if (!lab && !report.lot && !report.purity) return null;

  return (
    <section className="border-ink-200 rounded-lg border bg-white p-4">
      {lab && verification ? (
        <>
          <h3 className="text-ink-950 font-semibold">{lab.name}</h3>
          <p className="text-ink-700 mt-1 text-sm">{lab.warning}</p>
        </>
      ) : null}

      <dl className="text-ink-700 mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {report.lot ? (
          <>
            <dt className="text-ink-600">Lot</dt>
            <dd className="text-ink-950 font-mono break-all">{report.lot}</dd>
          </>
        ) : null}
        {report.purity ? (
          <>
            <dt className="text-ink-600">Purity</dt>
            <dd className="text-ink-950">{report.purity}</dd>
          </>
        ) : null}
      </dl>

      {lab && verification ? (
        <div className="mt-4">
          <p className="text-ink-700 text-sm">{COA_LOOKUP_INSTRUCTION}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="text-ink-950 border-ink-200 rounded-md border bg-white px-3 py-1.5 font-mono text-sm break-all">
              {verification.reportId}
            </code>
            <CopyButton value={verification.reportId} label="Copy code" />
          </div>
        </div>
      ) : null}

      {showVerify && verification ? (
        <div className="mt-4">
          <VerifyWithLabLink report={report} />
        </div>
      ) : null}
    </section>
  );
}
