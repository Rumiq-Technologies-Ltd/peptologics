"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";
import { cartActions, useCartSummary } from "@/hooks/useCart";
import { getAcknowledgementTimestamp } from "@/features/disclaimer/acknowledgement";
import { InquiryField } from "@/features/inquiry/components/InquiryField";
import type { InquiryResult } from "@/features/inquiry/types/inquiry";
import type { Product } from "@/features/products/types/product";
import {
  inquiryCustomerSchema,
  type InquiryCustomerFormValues,
  type InquiryCustomerInput,
} from "@/lib/validations/inquiry.schema";
import type { ApiResponse } from "@/types/api";

/**
 * The inquiry form.
 *
 * Validates with the *same* Zod schema the Route Handler uses, so a message the
 * visitor sees while typing is the message the server would have produced. Client
 * validation is a courtesy; the server never trusts it (`POST /api/inquiries`
 * re-parses the body from scratch).
 *
 * Three things here are load-bearing rather than stylistic:
 *
 * - **The idempotency key is generated once per mount.** A double-click, or a retry
 *   after a response was lost, replays the same key and the database returns the
 *   original order instead of creating a second one.
 * - **The payload carries no prices.** Only product IDs and quantities. The server
 *   reads `products.price_cents` itself (ADR-005), so the subtotal shown here is
 *   explicitly an estimate and cannot influence what is stored.
 * - **The honeypot is a plain ref, not a registered field.** Keeping it out of the
 *   schema means the server's answer to a bot is an ordinary 201, which teaches it
 *   nothing.
 */
export interface InquiryFormProps {
  /** The complete active catalog, from the page's server read. */
  catalog: readonly Product[];
}

/** Field paths the server may return, mapped onto the form's own names. */
const SERVER_FIELD_PREFIX = "customer.";

export function InquiryForm({ catalog }: InquiryFormProps) {
  const router = useRouter();
  const { lines, totals } = useCartSummary(catalog);

  const [formError, setFormError] = useState<string | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  /**
   * Mount time, for the server's dwell-time check. Bots post instantly; people cannot.
   *
   * Stamped in an effect rather than in the ref's initialiser: `Date.now()` during
   * render is impure, and the React compiler's purity rule is right to reject it.
   * After-mount is also the more accurate reading of "when the visitor saw the form".
   */
  const formStartedAt = useRef<number | null>(null);

  useEffect(() => {
    formStartedAt.current = Date.now();
  }, []);

  /**
   * Stable for the lifetime of this mount. Generated lazily so it is never computed
   * during server rendering, where it would be thrown away.
   */
  const idempotencyKey = useRef<string | null>(null);

  /** Invisible to people. Anything that fills it is not a person. */
  const honeypotRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InquiryCustomerFormValues, unknown, InquiryCustomerInput>({
    resolver: standardSchemaResolver(inquiryCustomerSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: "",
      apartment: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
    },
  });

  function focusErrorSummary(): void {
    // Moving focus is what makes the summary useful to a keyboard or screen-reader
    // user; `role="alert"` alone announces it but leaves the caret where it was.
    errorSummaryRef.current?.focus();
  }

  /** Maps `{ field: "customer.email" }` from the API back onto the form's fields. */
  function applyServerFieldErrors(errorList: { field: string; message: string }[]): boolean {
    let matched = false;

    for (const entry of errorList) {
      if (!entry.field.startsWith(SERVER_FIELD_PREFIX)) continue;

      const name = entry.field.slice(SERVER_FIELD_PREFIX.length) as keyof InquiryCustomerFormValues;
      setError(name, { type: "server", message: entry.message });
      matched = true;
    }

    return matched;
  }

  async function onSubmit(values: InquiryCustomerInput): Promise<void> {
    setFormError(null);

    if (lines.length === 0) {
      setFormError(MESSAGES.inquiry.emptySelection);
      focusErrorSummary();
      return;
    }

    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({
          customer: values,
          items: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          honeypot: honeypotRef.current?.value ?? "",
          // Null only if the effect has not run, which cannot happen by the time a
          // human has filled the form. Omitted rather than faked if it ever is.
          formStartedAt: formStartedAt.current ?? undefined,
          ruoAcknowledgedAt: getAcknowledgementTimestamp(),
        }),
      });

      const payload = (await response.json()) as ApiResponse<InquiryResult>;

      if (!payload.success) {
        const matched = payload.errors ? applyServerFieldErrors(payload.errors) : false;

        // Only surface the envelope message in the summary when it does not simply
        // repeat what is now shown beside the fields.
        setFormError(matched ? null : payload.message);
        focusErrorSummary();
        return;
      }

      /*
       * The list has served its purpose. Clearing before navigating means the back
       * button cannot land the visitor on a filled cart they have already submitted.
       */
      cartActions.clear();

      const reference = payload.data.orderNumber;
      router.push(reference ? `${ROUTES.inquirySuccess}?ref=${reference}` : ROUTES.inquirySuccess);
    } catch {
      // A thrown fetch means the network failed, so nothing reached the server. The
      // idempotency key is unchanged, so retrying is safe and cannot duplicate.
      setFormError(MESSAGES.inquiry.failed);
      focusErrorSummary();
    }
  }

  const fieldErrorCount = Object.keys(errors).length;
  const hasSummary = Boolean(formError) || fieldErrorCount > 0;

  return (
    <form
      noValidate
      /*
        Composed inside the event rather than during render. `handleSubmit(onSubmit)`
        evaluated in the JSX would hand React Hook Form a callback that reads refs,
        which the compiler's rules correctly flag as a render-time ref access.
      */
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-6"
    >
      {/*
        Always in the DOM so it is a stable live region: an alert inserted at the same
        moment its text appears is announced unreliably across screen readers.
      */}
      <div
        ref={errorSummaryRef}
        role="alert"
        tabIndex={-1}
        aria-live="polite"
        className={
          hasSummary
            ? "border-danger/40 bg-danger-bg text-ink-950 flex gap-3 rounded-lg border p-4 outline-none"
            : "sr-only"
        }
      >
        {hasSummary ? (
          <>
            <AlertCircleIcon className="text-danger mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-semibold">{formError ?? MESSAGES.inquiry.validationFailed}</p>
              {fieldErrorCount > 0 ? (
                <p className="text-ink-700 mt-1">
                  {fieldErrorCount} {fieldErrorCount === 1 ? "field needs" : "fields need"} your
                  attention below.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-5" disabled={isSubmitting}>
        <legend className="text-ink-950 text-h3 mb-2 font-semibold">Your details</legend>

        <InquiryField id="name" label="Full name" error={errors.name?.message}>
          {(props) => <Input {...props} {...register("name")} autoComplete="name" />}
        </InquiryField>

        <div className="grid gap-5 sm:grid-cols-2">
          <InquiryField id="email" label="Email" error={errors.email?.message}>
            {(props) => (
              <Input {...props} {...register("email")} type="email" autoComplete="email" />
            )}
          </InquiryField>

          <InquiryField
            id="phone"
            label="Phone"
            error={errors.phone?.message}
            hint="Include your country code if you are outside the US."
          >
            {(props) => <Input {...props} {...register("phone")} type="tel" autoComplete="tel" />}
          </InquiryField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5" disabled={isSubmitting}>
        <legend className="text-ink-950 text-h3 mb-2 font-semibold">Shipping address</legend>

        <InquiryField id="address" label="Street address" error={errors.address?.message}>
          {(props) => <Input {...props} {...register("address")} autoComplete="address-line1" />}
        </InquiryField>

        <InquiryField
          id="apartment"
          label="Apartment, suite, unit"
          optional
          error={errors.apartment?.message}
        >
          {(props) => <Input {...props} {...register("apartment")} autoComplete="address-line2" />}
        </InquiryField>

        <div className="grid gap-5 sm:grid-cols-3">
          <InquiryField id="city" label="City" error={errors.city?.message}>
            {(props) => <Input {...props} {...register("city")} autoComplete="address-level2" />}
          </InquiryField>

          <InquiryField id="state" label="State" error={errors.state?.message}>
            {(props) => <Input {...props} {...register("state")} autoComplete="address-level1" />}
          </InquiryField>

          <InquiryField id="zipCode" label="ZIP code" error={errors.zipCode?.message}>
            {(props) => <Input {...props} {...register("zipCode")} autoComplete="postal-code" />}
          </InquiryField>
        </div>
      </fieldset>

      <fieldset disabled={isSubmitting}>
        <InquiryField
          id="notes"
          label="Anything else we should know"
          optional
          error={errors.notes?.message}
          hint="Lot documentation requests, delivery timing, or questions for the representative."
        >
          {(props) => <Textarea {...props} {...register("notes")} rows={4} />}
        </InquiryField>
      </fieldset>

      {/*
        The honeypot. Off-screen rather than `display: none` — some bots skip hidden
        inputs, and this one is meant to be found. `aria-hidden` and `tabIndex={-1}`
        keep it away from anyone using a keyboard or a screen reader.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company-website">Company website</label>
        <input
          ref={honeypotRef}
          id="company-website"
          name="company-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div className="border-ink-200 flex flex-col gap-3 border-t pt-6">
        <p className="text-ink-600 text-sm">
          Submitting sends a request for a quotation. {MESSAGES.cart.estimateNotice}
        </p>

        <Button type="submit" size="lg" disabled={isSubmitting || lines.length === 0}>
          {isSubmitting ? (
            <>
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              Sending your inquiry…
            </>
          ) : (
            `Send inquiry${totals.lineCount > 0 ? ` (${totals.lineCount})` : ""}`
          )}
        </Button>

        {lines.length === 0 ? (
          <p className="text-ink-700 text-sm">
            {MESSAGES.cart.empty}{" "}
            <Link
              href={ROUTES.products}
              className="text-brand-600 font-medium underline underline-offset-2"
            >
              Browse the catalog
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}
