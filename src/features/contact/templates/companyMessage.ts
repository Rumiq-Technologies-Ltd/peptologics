import { SITE_NAME } from "@/constants/site";
import { escapeHtml, type EmailContent } from "@/features/inquiry/templates/emailContent";
import type { ContactFields } from "@/lib/validations/contact.schema";

/**
 * The email the company receives when someone uses the contact form.
 *
 * Written for the person who will answer it: the visitor's name in the subject, their
 * address and message in the body. The send sets `Reply-To` to the visitor, so answering
 * is a plain Reply.
 *
 * Every value is visitor input. The text body is inert; the HTML body passes each value
 * through `escapeHtml` at the point of insertion, as the inquiry templates do. The subject
 * carries the name, which `sanitizeText` has already collapsed onto one line, so it cannot
 * add a header.
 */

export function buildCompanyMessageEmail({ name, email, message }: ContactFields): EmailContent {
  const subject = `Website contact: ${name}`;

  const text = [
    "New website message",
    "",
    "CONTACT",
    `Name:  ${name}`,
    `Email: ${email}`,
    "",
    "MESSAGE",
    message,
    "",
    `Sent from the ${SITE_NAME} contact form. Reply to this email to answer the visitor directly.`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222223;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e4;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#58585d;">New website message</p>
      <h1 style="margin:0 0 24px;font-size:22px;">${escapeHtml(name)}</h1>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Contact</h2>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tr><td style="padding:4px 0;color:#58585d;width:80px;">Name</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:4px 0;color:#58585d;">Email</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#1d4ed8;">${escapeHtml(email)}</a></td></tr>
      </table>

      <h2 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:0.06em;color:#58585d;">Message</h2>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(message)}</p>

      <p style="margin:0;padding-top:16px;border-top:1px solid #e2e2e4;font-size:12px;color:#58585d;">
        Sent from the ${escapeHtml(SITE_NAME)} contact form. Reply to this email to answer the visitor directly.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
