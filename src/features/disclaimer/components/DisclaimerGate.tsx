"use client";

/*
 * The Research-Use-Only compliance gate.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ BEFORE EDITING
 *
 * 1. ESCAPE DOES NOTHING, ON PURPOSE. There is no keydown handler here, and that
 *    is the feature — a compliance gate must not be dismissible. This is also why
 *    it is hand-rolled rather than built on Radix Dialog or <dialog showModal()>:
 *    both bake Escape-to-close in at a level that is awkward to suppress
 *    reliably. Please do not "fix" this by adding a handler.
 *
 * 2. IT COVERS THE PAGE, IT DOES NOT HIDE IT. Page content stays in the DOM and
 *    stays CSS-visible behind a scrim. Nothing is display:none or
 *    visibility:hidden. The site must remain indexable, and content hidden
 *    pre-paint would be hidden from Googlebot too, since it crawls with an empty
 *    localStorage. See ADR-009.
 *
 * 3. NO USER-AGENT SNIFFING. Identical markup is served to bots and humans.
 *    Cloaking is a far larger risk than an interstitial, and age/legal gates are
 *    a stated exception to Google's intrusive-interstitial guidance.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { GATE_EXEMPT_ROUTES, ROUTES } from "@/constants/routes";
import { MINIMUM_AGE, RUO_ACKNOWLEDGEMENT_DAYS } from "@/constants/site";
import {
  getAcknowledgementSnapshot,
  getServerAcknowledgementSnapshot,
  recordAcknowledgement,
  subscribeToAcknowledgement,
} from "@/features/disclaimer/acknowledgement";
import { cn } from "@/utils/cn";

/**
 * The affirmations. Each is checked individually and none is pre-checked.
 *
 * There is no "accept all" button. A bulk-accept control destroys the evidentiary
 * value of individually affirmed statements, which is the only reason to have four
 * checkboxes rather than one. If this needs less friction, the lever is fewer
 * statements, not bulk-accept.
 *
 * TODO(legal): counsel review. This is professional, claim-free drafting, not
 * legal advice, and the client's counsel must approve the final wording before
 * launch. Tracked as open question 9 in docs/decisions.md.
 */
const AFFIRMATIONS = [
  { id: "age", label: `I am at least ${MINIMUM_AGE} years of age.` },
  {
    id: "researcher",
    label:
      "I am a qualified researcher, or I am purchasing on behalf of a licensed research institution or business, for lawful laboratory use only.",
  },
  {
    id: "ruo",
    label:
      "I understand these products are for in-vitro laboratory research use only and are not for human or animal consumption.",
  },
  { id: "terms", label: "I have read and accept the following:", hasLinks: true },
] as const;

const TERMS_OF_ACCESS = [
  "All products are supplied for in-vitro laboratory research use only.",
  "Product listings and pricing are indicative. Availability and final pricing are confirmed by a PeptoLogics representative before any transaction. This website does not process payments.",
  "Nothing on this website is medical, clinical, veterinary, or scientific advice, or a recommendation to purchase or use any product.",
  "A Certificate of Analysis applies only to the lot it identifies. Independent verification remains the responsibility of the purchaser.",
  "You are solely responsible for complying with all laws, regulations, licensing, and institutional requirements applicable in your jurisdiction.",
] as const;

export function DisclaimerGate() {
  const pathname = usePathname();
  const router = useRouter();

  const titleId = useId();
  const introId = useId();
  const statusId = useId();

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [checked, setChecked] = useState<Record<string, boolean>>({});

  /*
   * Acknowledgement is read through useSyncExternalStore because localStorage is
   * exactly that — an external store. This is preferable to reading it in an
   * effect and calling setState: it avoids a cascading render, and it gives
   * cross-tab release for free (see subscribeToAcknowledgement).
   *
   * The server snapshot is always false, so the gate IS in the server-rendered
   * HTML and blocks content from the first painted frame. If it only appeared
   * after hydration, a visitor on a slow connection would read the catalog first
   * and meet the disclaimer second, defeating its purpose.
   *
   * The cost is that a returning visitor would briefly see a gate they have
   * already accepted. The pre-paint inline script solves that: it sets
   * `data-ruo="ok"` on <html> and a CSS rule in globals.css hides the overlay
   * before the browser composites anything.
   */
  const accepted = useSyncExternalStore(
    subscribeToAcknowledgement,
    getAcknowledgementSnapshot,
    getServerAcknowledgementSnapshot,
  );

  /*
   * The gate must not cover the policy pages it links to. If /terms were itself
   * gated, opening it in a new tab would show a second gate and the visitor could
   * never read what they are being asked to accept.
   */
  const isExempt = GATE_EXEMPT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const isOpen = !accepted && !isExempt;

  /*
   * Focus trap and scroll lock.
   *
   * `inert` on #site-root removes the entire page from the tab order, the
   * accessibility tree, and pointer events with one attribute — no sentinel
   * elements needed. Applied by direct DOM mutation rather than as a React prop,
   * because the alternative would mean making the root layout a Client Component
   * and converting the whole tree for one attribute.
   */
  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;

    /*
     * A returning visitor's gate is already hidden by CSS via the pre-paint
     * script, and the store snapshot is about to unmount it. Locking scroll for
     * that one tick would cause a visible jump, so bail out.
     */
    if (html.getAttribute("data-ruo") === "ok") return;

    const siteRoot = document.getElementById("site-root");

    siteRoot?.setAttribute("inert", "");
    // scrollbar-gutter: stable is set globally, so locking causes no layout shift.
    html.style.overflow = "hidden";

    panelRef.current?.focus();

    // Belt-and-braces: if focus escapes despite `inert`, pull it back.
    function onFocusIn(event: FocusEvent) {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        panel.focus();
      }
    }

    document.addEventListener("focusin", onFocusIn);

    return () => {
      siteRoot?.removeAttribute("inert");
      html.style.overflow = "";
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [isOpen]);

  const remaining = AFFIRMATIONS.filter((item) => !checked[item.id]).length;
  const allChecked = remaining === 0;

  /*
   * Recording acceptance is all that is needed: `recordAcknowledgement` writes
   * storage, sets the `data-ruo` attribute, and notifies the store — which is what
   * flips `accepted` and unmounts this component. No local state to keep in sync.
   */
  const handleAccept = useCallback(() => {
    recordAcknowledgement();
  }, []);

  /**
   * Submit uses `aria-disabled`, not `disabled`.
   *
   * A truly disabled button is unfocusable, so a keyboard user tabbing to the end
   * of the dialog never encounters it and may not realise a submit exists.
   * Keeping it focusable and intercepting the click lets us explain what is
   * missing and move focus there.
   */
  const handleSubmit = useCallback(() => {
    if (allChecked) {
      handleAccept();
      return;
    }

    const firstUnchecked = AFFIRMATIONS.find((item) => !checked[item.id]);
    if (!firstUnchecked) return;

    const input = document.getElementById(`ruo-${firstUnchecked.id}`);
    input?.scrollIntoView({ block: "center", behavior: "smooth" });
    input?.focus();
  }, [allChecked, checked, handleAccept]);

  if (!isOpen) return null;

  return (
    <div
      // The hook the pre-paint script's CSS rule targets, so a returning visitor
      // never sees this composited. See globals.css.
      data-ruo-gate=""
      // Fixed overlay covering the viewport. The page behind stays visible —
      // blurred and dimmed, never hidden. See the header comment.
      className="bg-ink-950/80 fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 backdrop-blur-[3px] sm:items-center sm:p-6"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Points at the two intro paragraphs only. Describing the whole legal body
        // would make a screen reader recite five numbered terms and four checkbox
        // labels before the user can act.
        aria-describedby={introId}
        tabIndex={-1}
        className="shadow-overlay my-4 w-full max-w-2xl rounded-xl bg-white outline-none sm:my-0"
      >
        <div className="border-ink-200 bg-ink-50 flex items-start gap-4 rounded-t-xl border-b p-5 sm:p-6">
          <BrandLogo size={48} withWordmark={false} className="shrink-0" />
          <div className="min-w-0">
            <p className="text-eyebrow text-brand-800 flex items-center gap-1.5 uppercase">
              <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
              Restricted access
            </p>
            <h2 id={titleId} className="text-h3 text-ink-950 mt-1 font-bold">
              Research Use Only
            </h2>
            <p className="text-ink-600 mt-1 text-sm">
              Please review and acknowledge the following before entering.
            </p>
          </div>
        </div>

        {/*
          The scroll container is focusable with role="group" and a label, so a
          keyboard-only user can reach it and scroll the terms with arrow keys.
          WCAG 2.1.1 — and the single most commonly missed requirement in
          scrollable modals.
        */}
        <div
          ref={scrollRef}
          tabIndex={0}
          role="group"
          aria-label="Terms of access"
          className="max-h-[45vh] overflow-y-auto overscroll-contain p-5 sm:p-6"
        >
          <div id={introId} className="text-ink-700 space-y-3 text-sm">
            <p>
              PeptoLogics supplies lyophilized peptide compounds intended exclusively for laboratory
              and in-vitro research conducted by qualified professionals. Our products are not
              drugs, not dietary supplements, and not medical devices.
            </p>
            <p>
              They are not for human or animal consumption, are not approved by the FDA or any
              comparable authority for therapeutic use, and must not be administered to humans or
              animals. PeptoLogics is not a pharmacy. We do not provide dosing information,
              administration guidance, medical advice, or any clinical recommendation, and we do not
              supply diluents, syringes, or other administration materials.
            </p>
          </div>

          <h3 className="text-eyebrow text-ink-600 mt-6 uppercase">Terms of access</h3>
          <ol className="text-ink-700 mt-3 space-y-2.5 text-sm">
            {TERMS_OF_ACCESS.map((term, index) => (
              <li key={index} className="flex gap-3">
                <span className="text-brand-800 font-mono text-xs" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{term}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="border-ink-200 border-t p-5 sm:p-6">
          <fieldset>
            <legend className="text-ink-950 text-sm font-semibold">
              By continuing, you confirm each of the following:
            </legend>

            <div className="mt-4 space-y-1">
              {AFFIRMATIONS.map((item) => (
                <label
                  key={item.id}
                  htmlFor={`ruo-${item.id}`}
                  // 48px minimum row height, whole row clickable.
                  className="text-ink-800 hover:bg-ink-50 flex min-h-12 cursor-pointer items-start gap-3 rounded-md p-2 text-sm"
                >
                  <input
                    id={`ruo-${item.id}`}
                    type="checkbox"
                    aria-required="true"
                    checked={Boolean(checked[item.id])}
                    onChange={(event) =>
                      setChecked((previous) => ({
                        ...previous,
                        [item.id]: event.target.checked,
                      }))
                    }
                    className="border-ink-300 text-brand-800 accent-brand-800 mt-0.5 size-5 shrink-0 rounded"
                  />
                  <span>
                    {item.label}
                    {"hasLinks" in item && item.hasLinks ? (
                      <>
                        {" "}
                        <GateLink href={ROUTES.terms}>Terms of Use</GateLink>,{" "}
                        <GateLink href={ROUTES.privacy}>Privacy Policy</GateLink>, and the{" "}
                        <GateLink href={ROUTES.researchUseOnly}>Research-Use-Only Policy</GateLink>.
                      </>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Announces the enable transition without stealing focus. */}
          <p id={statusId} aria-live="polite" className="sr-only">
            {allChecked
              ? "All statements confirmed. Confirm and enter is now available."
              : `${remaining} of ${AFFIRMATIONS.length} statements remaining.`}
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/*
              min-h-11 on both: shadcn's `lg` size is 40px and `default` 36px, and
              this dialog is the one place on the site where a mis-tap has a
              compliance consequence. 44px is the WCAG 2.5.5 target size.
            */}
            <Button
              variant="ghost"
              onClick={() => router.push(ROUTES.notEligible)}
              className="text-ink-600 min-h-11"
            >
              Decline and exit
            </Button>

            <Button
              size="lg"
              // Focusable but inactive — see handleSubmit.
              aria-disabled={!allChecked}
              aria-describedby={statusId}
              onClick={handleSubmit}
              className={cn("min-h-11 w-full sm:w-auto", !allChecked && "opacity-50")}
            >
              Confirm &amp; enter
            </Button>
          </div>

          <p className="text-ink-500 mt-4 text-xs">
            Your acknowledgement will be remembered on this device for {RUO_ACKNOWLEDGEMENT_DAYS}{" "}
            days.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Policy links open in a new tab so acceptance progress is not lost. These routes
 * are in GATE_EXEMPT_ROUTES, so the new tab shows the policy rather than a second
 * gate.
 */
function GateLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-600 font-medium underline underline-offset-2"
    >
      {children}
    </a>
  );
}
