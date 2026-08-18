import { INQUIRY_RESPONSE_HOURS } from "@/constants/business";
import { COMPLIANCE_NOTICE_LONG, SITE_NAME } from "@/constants/site";
import { escapeHtml, type EmailContent } from "@/features/inquiry/templates/emailContent";
import type { InquiryNotification } from "@/features/inquiry/types/inquiry";
import { formatCurrencyExact } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/**
 * The confirmation sent to the customer.
 *
 * Its whole job is to answer the question a visitor has the moment they hit submit:
 * *did that work, and what happens now?* So it says three things and stops — we have
 * your request, here is what you asked for, a representative will be in touch within
 * `INQUIRY_RESPONSE_HOURS` hours.
 *
 * **It never says "order".** Nothing was bought, no payment was taken, and every other
 * surface — the list, the success page, the internal email — is careful about that. An
 * email that announced a placed order would be the one place the site told the customer
 * they had purchased something, and it would be the version they kept. The reference
 * number is called a reference, and the money is labelled "estimated".
 *
 * The figures are the ones the visitor saw, priced server-side from the catalog. They are
 * repeated here so the customer has a record of what they asked for, and marked estimated
 * because availability and the final total are confirmed on the call, not by this email.
 *
 * Escaping follows the same rule as the internal template: the text body is inert, and
 * every value interpolated into HTML passes through `escapeHtml` at the point of
 * insertion. The customer's own name and notes are still untrusted input — a visitor can
 * put a `<script>` tag in a notes field, and this message is rendered by their mail
 * client, not ours.
 */

/** Where a customer reply should land. Their own address is never a useful reply-to. */
export interface CustomerConfirmationOptions {
  /**
   * The address a customer should reach a human on, if the mail client's reply button is
   * not enough. Absent when no internal recipient is configured — the paragraph naming an
   * address is then omitted rather than rendering an empty one.
   */
  replyToAddress?: string;
}

export function buildCustomerConfirmationEmail(
  notification: InquiryNotification,
  options: CustomerConfirmationOptions = {},
): EmailContent {
  const { customer, items, subtotalCents, discountCents, totalCents, orderNumber } = notification;

  // Same rule as the internal template: a "-$0.00" line on every message is noise, and
  // noise is what teaches a reader to skip the line that one day matters.
  const hasDiscount = discountCents > 0;

  // First name only, and only when it is unambiguous. "Hi Dr. Amara Okonkwo-Reyes," reads
  // like a form letter; splitting on whitespace and taking the first token reads like a
  // person wrote it. A single-word name is used whole.
  const firstName = customer.name.trim().split(/\s+/)[0] ?? customer.name;

  const subject = `We've received your inquiry — ${orderNumber}`;

  const responseLine = `A representative will contact you within ${INQUIRY_RESPONSE_HOURS} hours to confirm availability, lot documentation and the final pricing.`;

  const text = [
    `Hi ${firstName},`,
    "",
    `Thank you for your inquiry. We have received it and it is with our team now.`,
    "",
    responseLine,
    "",
    `Your reference: ${orderNumber}`,
    "",
    "WHAT YOU REQUESTED",
    ...items.map(
      (item) =>
        `${item.quantity} x ${item.productName} ${formatStrength(item.strengthMg)} @ ${formatCurrencyExact(
          item.unitPriceCents,
        )} = ${formatCurrencyExact(item.subtotalCents)}`,
    ),
    "",
    `Estimated subtotal: ${formatCurrencyExact(subtotalCents)}`,
    ...(hasDiscount
      ? [
          `Discount applied:   -${formatCurrencyExact(discountCents)}`,
          `Estimated total:    ${formatCurrencyExact(totalCents)}`,
        ]
      : []),
    "",
    "These are the list prices shown on the website. No payment has been taken and nothing",
    "has been charged — this is an inquiry, and your representative confirms the final total",
    "with you before anything is arranged.",
    ...(options.replyToAddress
      ? [
          "",
          `If you need to add anything, reply to this email or write to ${options.replyToAddress}.`,
        ]
      : ["", "If you need to add anything, simply reply to this email."]),
    "",
    COMPLIANCE_NOTICE_LONG,
    "",
    SITE_NAME,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222223;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e4;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#58585d;">Inquiry received</p>
      <h1 style="margin:0 0 16px;font-size:22px;">Thank you, ${escapeHtml(firstName)}</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        We have your inquiry and it is with our team now. ${escapeHtml(responseLine)}
      </p>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#58585d;">
        Your reference is <strong style="color:#222223;">${escapeHtml(orderNumber)}</strong>. Quote it in any reply and we will find your inquiry straight away.
      </p>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">What you requested</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th align="left" style="padding:6px 0;border-bottom:1px solid #e2e2e4;color:#58585d;font-weight:600;">Product</th>
            <th align="right" style="padding:6px 0;border-bottom:1px solid #e2e2e4;color:#58585d;font-weight:600;">Qty</th>
            <th align="right" style="padding:6px 0;border-bottom:1px solid #e2e2e4;color:#58585d;font-weight:600;">Unit</th>
            <th align="right" style="padding:6px 0;border-bottom:1px solid #e2e2e4;color:#58585d;font-weight:600;">Line</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `<tr>
            <td style="padding:8px 0;border-bottom:1px solid #efeff0;">${escapeHtml(item.productName)}<br /><span style="color:#58585d;font-size:12px;">${escapeHtml(formatStrength(item.strengthMg))} per vial</span></td>
            <td align="right" style="padding:8px 0;border-bottom:1px solid #efeff0;">${item.quantity}</td>
            <td align="right" style="padding:8px 0;border-bottom:1px solid #efeff0;">${formatCurrencyExact(item.unitPriceCents)}</td>
            <td align="right" style="padding:8px 0;border-bottom:1px solid #efeff0;font-weight:600;">${formatCurrencyExact(item.subtotalCents)}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" align="right" style="padding:10px 0;font-weight:600;">Estimated subtotal</td>
            <td align="right" style="padding:10px 0;font-weight:700;">${formatCurrencyExact(subtotalCents)}</td>
          </tr>
          ${
            hasDiscount
              ? `<tr>
            <td colspan="3" align="right" style="padding:4px 0;color:#0f7b4f;">Discount applied</td>
            <td align="right" style="padding:4px 0;font-weight:600;color:#0f7b4f;">-${formatCurrencyExact(discountCents)}</td>
          </tr>
          <tr>
            <td colspan="3" align="right" style="padding:10px 0;border-top:1px solid #e2e2e4;font-weight:700;">Estimated total</td>
            <td align="right" style="padding:10px 0;border-top:1px solid #e2e2e4;font-weight:700;">${formatCurrencyExact(totalCents)}</td>
          </tr>`
              : ""
          }
        </tfoot>
      </table>

      <p style="margin:12px 0 24px;font-size:12px;line-height:1.6;color:#58585d;">
        These are the list prices shown on the website. No payment has been taken and nothing has been charged — this is an inquiry, and your representative confirms the final total with you before anything is arranged.
      </p>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
        ${
          options.replyToAddress
            ? `If you need to add anything, reply to this email or write to <a href="mailto:${escapeHtml(options.replyToAddress)}" style="color:#1d4ed8;">${escapeHtml(options.replyToAddress)}</a>.`
            : "If you need to add anything, simply reply to this email."
        }
      </p>

      <p style="margin:0;padding-top:16px;border-top:1px solid #e2e2e4;font-size:12px;line-height:1.6;color:#58585d;">
        ${escapeHtml(COMPLIANCE_NOTICE_LONG)}<br /><br />
        ${escapeHtml(SITE_NAME)}
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
