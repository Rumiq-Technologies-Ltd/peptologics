import { INQUIRY_RESPONSE_HOURS } from "@/constants/business";
import { COMPLIANCE_NOTICE_LONG, SITE_NAME } from "@/constants/site";
import { escapeHtml, type EmailContent } from "@/features/inquiry/templates/emailContent";

/**
 * The confirmation the visitor receives after using the contact form.
 *
 * **Fixed text, on purpose.** It takes no name and no message, so nothing a visitor types
 * can appear in it. The address it goes to is chosen by a stranger; if the body carried
 * their words, the form could be used to send chosen text to any inbox under our name.
 * With fixed text the worst case is one polite, identical message per allowed submission.
 *
 * The response time comes from the same constant as the inquiry confirmation, so the two
 * emails can never promise different things.
 */

export interface VisitorConfirmationOptions {
  /**
   * An address a human can be reached on, if the mail client's reply button is not
   * enough. Absent when no internal recipient is configured; the sentence is then
   * shortened rather than naming an empty address.
   */
  replyToAddress?: string;
}

export const VISITOR_CONFIRMATION_SUBJECT = `We've received your message — ${SITE_NAME}`;

export function buildVisitorConfirmationEmail(
  options: VisitorConfirmationOptions = {},
): EmailContent {
  const intro = `Thanks for contacting ${SITE_NAME}. We've received your message and a representative will reply to this address within ${INQUIRY_RESPONSE_HOURS} hours.`;

  const followUp = options.replyToAddress
    ? `If you need to add anything, reply to this email or write to ${options.replyToAddress}.`
    : "If you need to add anything, simply reply to this email.";

  const text = ["Hello,", "", intro, "", followUp, "", COMPLIANCE_NOTICE_LONG, "", SITE_NAME].join(
    "\n",
  );

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222223;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e4;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#58585d;">Message received</p>
      <h1 style="margin:0 0 16px;font-size:22px;">Thank you for getting in touch</h1>

      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>

      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
        ${
          options.replyToAddress
            ? `If you need to add anything, reply to this email or write to <a href="mailto:${escapeHtml(options.replyToAddress)}" style="color:#1d4ed8;">${escapeHtml(options.replyToAddress)}</a>.`
            : escapeHtml(followUp)
        }
      </p>

      <p style="margin:0;padding-top:16px;border-top:1px solid #e2e2e4;font-size:12px;line-height:1.6;color:#58585d;">
        ${escapeHtml(COMPLIANCE_NOTICE_LONG)}<br /><br />
        ${escapeHtml(SITE_NAME)}
      </p>
    </div>
  </body>
</html>`;

  return { subject: VISITOR_CONFIRMATION_SUBJECT, text, html };
}
