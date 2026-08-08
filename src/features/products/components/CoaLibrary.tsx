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
 * Certificates are portrait scans, roughly 1290×2000. A fixed aspect box would crop
 * them, so the image is height-constrained and the dialog scrolls if it must.
 */
const COA_INTRINSIC_WIDTH = 1290;
const COA_INTRINSIC_HEIGHT = 2000;

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
                {formatStrength(product.strengthMg)} per vial
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
                  readers only — otherwise every button announces identically. */}
              <span className="sr-only"> for {product.name}</span>
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
                  {formatStrength(viewed.strengthMg)} per vial. A certificate applies only to the
                  lot it identifies.
                </DialogDescription>
              </DialogHeader>

              <div className="p-5">
                <Image
                  src={viewed.coaUrl ?? ""}
                  alt={`Certificate of Analysis for ${viewed.name}`}
                  width={COA_INTRINSIC_WIDTH}
                  height={COA_INTRINSIC_HEIGHT}
                  // The scan is the content, so it is worth the bytes at full width.
                  sizes="(max-width: 768px) 100vw, 700px"
                  className="border-ink-200 h-auto w-full rounded-lg border"
                />

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
