import { ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/features/coa/components/CopyButton";
import { COA_LABS, COA_LOOKUP_INSTRUCTION } from "@/features/coa/constants/labs";
import type { CoaReport } from "@/features/coa/constants/coaReports";

/**
 * One laboratory report: who issued it, the lot and purity, and how to check it.
 *
 * The site publishes a copy (or only a pointer); the laboratory's own record is the
 * authority, and fraudulent certificates that borrow a lab's name are in circulation. So the
 * code is always on screen, one click from the clipboard, beside a link to the lab itself.
 * A report with no verification (an other-company report) shows the lot and purity only.
 */
export interface CoaReportDetailsProps {
  report: CoaReport;
  /** Extra buttons placed beside "Verify with lab", such as "Open PDF". */
  actions?: React.ReactNode;
}

export function CoaReportDetails({ report, actions }: CoaReportDetailsProps) {
  const { verification } = report;
  const lab = verification ? COA_LABS[verification.labId] : null;

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
            <dd className="text-ink-950 font-mono">{report.lot}</dd>
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
            <code className="text-ink-950 border-ink-200 rounded-md border bg-white px-3 py-1.5 font-mono text-sm">
              {verification.reportId}
            </code>
            <CopyButton value={verification.reportId} label="Copy code" />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {actions}
        {lab && verification ? (
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-9">
            <a
              href={lab.verifyUrl(verification.reportId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ShieldCheckIcon aria-hidden="true" />
              Verify with lab
              <ExternalLinkIcon aria-hidden="true" />
              <span className="sr-only"> ({lab.shortName}, opens in a new tab)</span>
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
