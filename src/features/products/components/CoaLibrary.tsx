"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ExternalLinkIcon, FileTextIcon, HistoryIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoaFacts, VerifyWithLabLink } from "@/features/coa/components/CoaFacts";
import {
  DEFAULT_PREVIOUS_LABEL,
  getCoaEntry,
  getPreviousReport,
  isPdf,
  type CoaEntry,
  type CoaReport,
} from "@/features/coa/constants/coaReports";
import type { Product } from "@/features/products/types/product";
import { formatStrength } from "@/utils/formatStrength";
import { cn } from "@/utils/cn";

/**
 * The published Certificate of Analysis library.
 *
 * A row per compound — name on the left, a button on the right — and the certificate
 * itself in a dialog rather than a new tab, so the visitor never loses the page they
 * were reading.
 *
 * The list is the catalog filtered to products with an entry in `COA_ENTRIES` (the single
 * source of truth for COAs, keyed by slug), so a product without one simply does not
 * appear rather than offering a dead button. A hosted image scan shows in the dialog; a
 * hosted PDF opens in a new tab from the dialog; a link-only product shows the lab
 * reports and sends the customer to the lab.
 *
 * Only the dialog is client-side. The page around it, including this list's server-read
 * data, stays a Server Component.
 */
export interface CoaLibraryProps {
  /** The active catalog. Products without a certificate are filtered out here. */
  products: readonly Product[];
}

/**
 * The reserved well for a certificate scan, as a Tailwind aspect ratio.
 *
 * The scans are portrait but not a uniform size — the published set runs from 968×1495
 * to 1290×2078, and the MOTS-c 40 mg certificate added on 16 Aug 2026 is 1206×1507,
 * appreciably wider than the rest. Passing one fixed `width`/`height` pair to
 * `next/image` and letting CSS derive the height stretched anything that did not match
 * that pair, which was invisible while every scan sat near 0.645 and obvious at 0.800.
 *
 * So the box owns the aspect ratio and the image is contained inside it, the same
 * arrangement `ProductImage` uses for vials: space is reserved before the scan loads, so
 * opening the dialog does not shift its own contents, and no certificate is ever
 * distorted to fit. A wider scan simply renders full width with room above and below.
 */
const COA_WELL_ASPECT = "aspect-[1290/2000]";

type View = "current" | "previous";

interface ViewedCoa {
  product: Product;
  entry: CoaEntry;
}

export function CoaLibrary({ products }: CoaLibraryProps) {
  const documented = products.flatMap((product): ViewedCoa[] => {
    const entry = getCoaEntry(product.slug);
    return entry ? [{ product, entry }] : [];
  });

  /*
   * Two pieces of state rather than one, on purpose.
   *
   * `isOpen` drives the dialog; `viewed` holds what to render and is deliberately *not*
   * cleared on close. Radix keeps the content mounted through its exit animation, so
   * deriving the content from the open state alone empties the panel the instant the
   * close begins — the visitor watches an empty box fade out.
   */
  const [isOpen, setIsOpen] = useState(false);
  const [viewed, setViewed] = useState<ViewedCoa | null>(null);
  const [view, setView] = useState<View>("current");

  /*
   * The button that opened the dialog, so focus can be put back on it. Radix restores
   * focus to its own `DialogTrigger`, and there isn't one here: one dialog serves every row.
   */
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  if (documented.length === 0) return null;

  function openCertificate(coa: ViewedCoa, trigger: HTMLButtonElement): void {
    triggerRef.current = trigger;
    setViewed(coa);
    setView("current");
    setIsOpen(true);
  }

  const previous = viewed ? getPreviousReport(viewed.entry) : null;
  const showingPrevious = view === "previous" && previous !== null;

  // What this view shows. Everything below is derived from the entry: no per-product code.
  const reports: readonly CoaReport[] =
    viewed === null ? [] : showingPrevious && previous ? [previous] : viewed.entry.current;
  const verifiable = reports.filter((report) => report.verification !== null);
  const headerReport = verifiable.length === 1 ? (verifiable[0] ?? null) : null;
  // The file the action row opens. Only a single hosted report has one.
  const hostedFile = reports.length === 1 ? (reports[0]?.file ?? null) : null;

  return (
    <>
      <ul className="divide-ink-100 border-ink-200 divide-y rounded-xl border bg-white">
        {documented.map(({ product, entry }) => (
          <li
            key={product.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
          >
            <div className="min-w-0">
              <p className="text-ink-950 font-semibold">{product.name}</p>
              <p className="text-ink-600 mt-0.5 font-mono text-xs">
                {formatStrength(product.strengthMg, product.strengthUnit)} per vial
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0 sm:min-h-9"
              onClick={(event) => openCertificate({ product, entry }, event.currentTarget)}
            >
              <FileTextIcon aria-hidden="true" />
              View COA
              {/* The visible label repeats on every row, so the name goes to screen
                  readers only — otherwise every button announces identically. The
                  strength goes with it: the name alone no longer identifies a row. */}
              <span className="sr-only">
                {" "}
                for {product.name} {formatStrength(product.strengthMg, product.strengthUnit)}
              </span>
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className="max-h-[92svh] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          {viewed ? (
            <>
              <DialogHeader className="border-ink-200 sticky top-0 z-10 border-b bg-white p-5 pr-14 text-left">
                {/* One verifiable report in this view: the button sits top right, beside the
                    close X, so it is on screen without scrolling past the scan. */}
                <div className="flex items-start justify-between gap-x-3">
                  <div className="min-w-0">
                    <DialogTitle>
                      {viewed.product.name} —{" "}
                      {showingPrevious ? "Previous certificate" : "Certificate of Analysis"}
                    </DialogTitle>
                    <DialogDescription className="mt-2">
                      {formatStrength(viewed.product.strengthMg, viewed.product.strengthUnit)} per
                      vial.{" "}
                      {showingPrevious
                        ? "An earlier report with its own lot. It does not describe the current lot."
                        : "A certificate applies only to the lot it identifies."}
                    </DialogDescription>
                  </div>
                  {headerReport ? <VerifyWithLabLink report={headerReport} /> : null}
                </div>
              </DialogHeader>

              <div className="space-y-4 p-5">
                {reports.map((report) => (
                  <ReportView
                    key={report.verification?.reportId ?? report.file}
                    product={viewed.product}
                    report={report}
                    showVerify={headerReport === null}
                  />
                ))}

                <div className="flex flex-wrap gap-3 empty:hidden">
                  {hostedFile ? <OpenFileLink file={hostedFile} /> : null}
                  {previous && !showingPrevious ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      onClick={() => setView("previous")}
                    >
                      <HistoryIcon aria-hidden="true" />
                      {previous.label ?? DEFAULT_PREVIOUS_LABEL}
                    </Button>
                  ) : null}
                  {showingPrevious ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      onClick={() => setView("current")}
                    >
                      <Undo2Icon aria-hidden="true" />
                      Back to current certificate
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ReportViewProps {
  product: Product;
  report: CoaReport;
  /** Put "Verify with lab" inside this report's facts (two or more reports in the view). */
  showVerify: boolean;
}

/** One report: its facts first, then the scan if it is an image hosted on this site. */
function ReportView({ product, report, showVerify }: ReportViewProps) {
  const file = report.file;

  return (
    <>
      <CoaFacts report={report} showVerify={showVerify} />

      {file && !isPdf(file) ? (
        <div
          className={cn(
            "border-ink-200 relative w-full overflow-hidden rounded-lg border bg-white",
            COA_WELL_ASPECT,
          )}
        >
          <Image
            src={file}
            alt={`Certificate of Analysis for ${product.name}`}
            fill
            // The scan is the content, so it is worth the bytes at full width.
            sizes="(max-width: 768px) 100vw, 700px"
            className="object-contain"
          />
        </div>
      ) : null}
    </>
  );
}

/** Escape hatch for anyone who wants to zoom, print or save the file. */
function OpenFileLink({ file }: { file: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-9">
      <a href={file} target="_blank" rel="noopener noreferrer">
        <ExternalLinkIcon aria-hidden="true" />
        {isPdf(file) ? "Open PDF" : "Open full size"}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}
