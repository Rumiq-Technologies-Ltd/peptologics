import { SITE_NAME } from "@/constants/site";
import type { InquiryNotification } from "@/features/inquiry/types/inquiry";
import { formatCurrencyExact } from "@/utils/formatCurrency";
import { formatStrength } from "@/utils/formatStrength";

/**
 * The internal inquiry notification.
 *
 * Written for the person who has to make the follow-up call: the reference and the
 * customer's name in the subject, contact details first, then the requested lines
 * with the prices the visitor actually saw.
 *
 * Both a plain-text and an HTML body are produced. Text is not a courtesy — some
 * corporate mail clients strip HTML entirely, and an inquiry that arrives blank is
 * a lost lead.
 *
 * Every interpolated value is customer input. The text body is inert by nature; the
 * HTML body escapes each value at the point of insertion. There is no template
 * engine here, so escaping cannot be forgotten silently — it is a visible call
 * around every field.
 */

/** Escapes the five characters that can break out of HTML text or an attribute. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildInternalNotificationEmail(notification: InquiryNotification): EmailContent {
  const { customer, items, subtotalCents, discountCents, totalCents, orderNumber } = notification;

  /*
   * The discount rows appear only when there is one. An "Discount: $0.00" line on
   * every inquiry is noise the representative would learn to skip, and the one time
   * it mattered they would skip it too.
   *
   * `couponCode` is deliberately absent from this template's data: the notification
   * carries the amount, and the amount is what the representative quotes from. If the
   * operator ever needs to know which code was used, it is on the order row.
   */
  const hasDiscount = discountCents > 0;

  const addressLines = [
    customer.address,
    customer.apartment,
    `${customer.city}, ${customer.state} ${customer.zipCode}`,
  ].filter((line): line is string => Boolean(line));

  const subject = `New inquiry ${orderNumber} — ${customer.name} (${items.length} ${
    items.length === 1 ? "product" : "products"
  })`;

  const text = [
    `New inquiry ${orderNumber}`,
    "",
    "CUSTOMER",
    `Name:    ${customer.name}`,
    `Email:   ${customer.email}`,
    `Phone:   ${customer.phone}`,
    "",
    "SHIPPING ADDRESS",
    ...addressLines,
    "",
    "REQUESTED PRODUCTS",
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
    "Prices are the list prices shown to the customer. Confirm availability and the final total.",
    ...(customer.notes ? ["", "CUSTOMER NOTES", customer.notes] : []),
    "",
    `Sent by ${SITE_NAME}. No payment was taken — this is an inquiry, not an order.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222223;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e4;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#58585d;">New inquiry</p>
      <h1 style="margin:0 0 24px;font-size:22px;">${escapeHtml(orderNumber)}</h1>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Customer</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;color:#58585d;width:80px;">Name</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(customer.name)}</td></tr>
        <tr><td style="padding:4px 0;color:#58585d;">Email</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(customer.email)}" style="color:#1d4ed8;">${escapeHtml(customer.email)}</a></td></tr>
        <tr><td style="padding:4px 0;color:#58585d;">Phone</td><td style="padding:4px 0;">${escapeHtml(customer.phone)}</td></tr>
      </table>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Shipping address</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">${addressLines.map(escapeHtml).join("<br />")}</p>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Requested products</h2>
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
      <p style="margin:8px 0 24px;font-size:12px;color:#58585d;">List prices as shown to the customer. Confirm availability and the final total.</p>

      ${
        customer.notes
          ? `<h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Customer notes</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(customer.notes)}</p>`
          : ""
      }

      <p style="margin:0;padding-top:16px;border-top:1px solid #e2e2e4;font-size:12px;color:#58585d;">
        Sent by ${escapeHtml(SITE_NAME)}. No payment was taken — this is an inquiry, not an order.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
