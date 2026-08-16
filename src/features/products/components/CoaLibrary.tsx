"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ExternalLinkIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
 * The list is built from the catalog, filtered to products that actually have a
 * `coa_url`. Nothing is hardcoded: adding a certificate is a database update and a file,
 * and a product without one simply does not appear rather than offering a dead button.
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

export function CoaLibrary({ products }: CoaLibraryProps) {
  const documented = products.filter((product) => Boolean(product.coaUrl));

  /*
   * Two pieces of state rather than one, on purpose.
   *
   * `isOpen` drives the dialog; `viewed` holds what to render and is deliberately *not*
   * cleared on close. Radix keeps the content mounted through its exit animation, so
   * deriving the content from the open state alone empties the panel the instant the
   * close begins — the visitor watches an empty box fade out. Verified in the browser
   * before this was split.
   */
  const [isOpen, setIsOpen] = useState(false);
  const [viewed, setViewed] = useState<Product | null>(null);

  /*
   * The button that opened the dialog, so focus can be put back on it.
   *
   * Radix restores focus to its own `DialogTrigger`, and there isn't one here — the
   * dialog is driven from state so that one dialog can serve every row. Without this,
   * closing dropped focus to `<body>` and a keyboard user had to tab from the top of the
   * page again. Caught by an end-to-end test, not by looking.
   */
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  if (documented.length === 0) return null;

  function openCertificate(product: Product, trigger: HTMLButtonElement): void {
    triggerRef.current = trigger;
    setViewed(product);
    setIsOpen(true);
  }

  return (
    <>
      <ul className="divide-ink-100 border-ink-200 divide-y rounded-xl border bg-white">
        {documented.map((product) => (
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
              onClick={(event) => openCertificate(product, event.currentTarget)}
            >
              <FileTextIcon aria-hidden="true" />
              View COA
              {/* The visible label repeats on every row, so the name goes to screen
                  readers only — otherwise every button announces identically. The
                  strength goes with it: since the catalog began stocking two vial sizes
                  of MOTS-c, the name alone no longer identifies a row uniquely. */}
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
              <DialogHeader className="border-ink-200 sticky top-0 z-10 border-b bg-white p-5 text-left">
                <DialogTitle>{viewed.name} — Certificate of Analysis</DialogTitle>
                <DialogDescription>
                  {formatStrength(viewed.strengthMg, viewed.strengthUnit)} per vial. A certificate
                  applies only to the lot it identifies.
                </DialogDescription>
              </DialogHeader>

              <div className="p-5">
                <div
                  className={cn(
                    "border-ink-200 relative w-full overflow-hidden rounded-lg border bg-white",
                    COA_WELL_ASPECT,
                  )}
                >
                  <Image
                    src={viewed.coaUrl ?? ""}
                    alt={`Certificate of Analysis for ${viewed.name}`}
                    fill
                    // The scan is the content, so it is worth the bytes at full width.
                    sizes="(max-width: 768px) 100vw, 700px"
                    className="object-contain"
                  />
                </div>

                <Button asChild variant="outline" size="sm" className="mt-4">
                  {/* Escape hatch for anyone who wants to zoom, print or save it. */}
                  <a href={viewed.coaUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon aria-hidden="true" />
                    Open full size
                  </a>
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
