"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { AlertCircleIcon, CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/constants/messages";
import { InquiryField } from "@/features/inquiry/components/InquiryField";
import { contactEmail } from "@/lib/env.client";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  contactFieldsSchema,
  type ContactFields,
  type ContactFormValues,
} from "@/lib/validations/contact.schema";
import type { ApiResponse } from "@/types/api";

/**
 * The contact form.
 *
 * Validates with the same Zod schema `POST /api/contact` uses, so the message a visitor
 * sees while typing is the one the server would have produced. Client validation is a
 * courtesy; the server re-parses everything.
 *
 * Built from the inquiry form's pieces (`InquiryField`, the honeypot ref, the dwell-time
 * clock) rather than beside them. Two things matter as much as they do there:
 *
 * - **The honeypot is a plain ref, not a registered field,** so the server's answer to a
 *   bot is an ordinary success that teaches it nothing.
 * - **The elapsed time is sent as a duration, never a timestamp** (ADR-028), so a device
 *   with a wrong clock cannot make a person look like a bot.
 *
 * Nothing is saved on the server, so on a failed send the form keeps what was typed and
 * points at the email address as the fallback.
 */

/** The honeypot's DOM id and name. Matches no autofill heuristic. */
const HONEYPOT_FIELD = "leave-blank-field";

export function ContactForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  /** Mount time on the monotonic clock, stamped in an effect because reading it is impure. */
  const mountedAt = useRef<number | null>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues, unknown, ContactFields>({
    resolver: standardSchemaResolver(contactFieldsSchema),
    mode: "onBlur",
    defaultValues: { name: "", email: "", message: "" },
  });

  /** Shown when the message may not have been sent. Names the address when we have one. */
  const sendFailureMessage = contactEmail
    ? `${MESSAGES.contact.failed} Please email us at ${contactEmail}.`
    : `${MESSAGES.contact.failed} Please use the email address on this page instead.`;

  function focusErrorSummary(): void {
    // `role="alert"` announces the summary but leaves the caret where it was; moving focus
    // is what makes it useful to a keyboard or screen-reader user.
    errorSummaryRef.current?.focus();
  }

  /** Maps `{ field: "email" }` from the API back onto the form's fields. */
  function applyServerFieldErrors(errorList: { field: string; message: string }[]): boolean {
    let matched = false;

    for (const entry of errorList) {
      if (entry.field !== "name" && entry.field !== "email" && entry.field !== "message") continue;

      setError(entry.field, { type: "server", message: entry.message });
      matched = true;
    }

    return matched;
  }

  async function onSubmit(values: ContactFields): Promise<void> {
    setFormError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          honeypot: honeypotRef.current?.value ?? "",
          // Omitted, not faked, if the mount effect never ran: an absent measurement is a
          // failed dwell check on the server, so a missing value is never a free pass.
          formElapsedMs:
            mountedAt.current === null
              ? undefined
              : Math.round(performance.now() - mountedAt.current),
        }),
      });

      const payload = (await response.json()) as ApiResponse<unknown>;

      if (payload.success) {
        setSent(true);
        // Mounted by the state change, so focus it on the next frame.
        requestAnimationFrame(() => successRef.current?.focus());
        return;
      }

      if (response.status === 422) {
        const matched = payload.errors ? applyServerFieldErrors(payload.errors) : false;
        setFormError(matched ? null : payload.message);
      } else if (response.status === 429) {
        setFormError(payload.message);
      } else {
        setFormError(sendFailureMessage);
      }

      focusErrorSummary();
    } catch {
      // A thrown fetch means the network failed and nothing reached the server.
      setFormError(sendFailureMessage);
      focusErrorSummary();
    }
  }

  if (sent) {
    return (
      <div
        ref={successRef}
        role="status"
        tabIndex={-1}
        className="border-brand-200 bg-brand-50 text-ink-950 flex gap-3 rounded-lg border p-5 outline-none"
      >
        <CheckCircle2Icon className="text-brand-600 mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{MESSAGES.contact.success}</p>
          <p className="text-ink-700 mt-1 text-sm">{MESSAGES.contact.successDetail}</p>
        </div>
      </div>
    );
  }

  const fieldErrorCount = Object.keys(errors).length;
  const hasSummary = Boolean(formError) || fieldErrorCount > 0;

  return (
    <form
      noValidate
      // Composed inside the event: `handleSubmit(onSubmit)` evaluated in the JSX would hand
      // React Hook Form a callback that reads refs, which the compiler flags as a render-time
      // ref access.
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="flex flex-col gap-5"
    >
      {/* Always in the DOM so it is a stable live region. */}
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
              <p className="font-semibold">{formError ?? MESSAGES.contact.validationFailed}</p>
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

      <p className="text-ink-600 text-sm">Every field is required.</p>

      <fieldset className="flex flex-col gap-5" disabled={isSubmitting}>
        <legend className="sr-only">Your message</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <InquiryField id="contact-name" label="Name" error={errors.name?.message}>
            {(props) => <Input {...props} {...register("name")} autoComplete="name" />}
          </InquiryField>

          <InquiryField id="contact-email" label="Email" error={errors.email?.message}>
            {(props) => (
              <Input {...props} {...register("email")} type="email" autoComplete="email" />
            )}
          </InquiryField>
        </div>

        <InquiryField
          id="contact-message"
          label="Message"
          error={errors.message?.message}
          hint={`Up to ${CONTACT_MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`}
        >
          {(props) => <Textarea {...props} {...register("message")} rows={6} />}
        </InquiryField>
      </fieldset>

      {/*
        The honeypot. Off-screen rather than `display: none` (some bots skip hidden
        inputs), with `aria-hidden` and `tabIndex={-1}` to keep it away from keyboard and
        screen-reader users. Named so no browser autofills it.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD}>Leave this field blank</label>
        <input
          ref={honeypotRef}
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      <div>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            "Send message"
          )}
        </Button>
      </div>
    </form>
  );
}
