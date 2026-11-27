import { describe, expect, it } from "vitest";

import { INQUIRY_RESPONSE_HOURS } from "@/constants/business";
import { buildCompanyMessageEmail } from "@/features/contact/templates/companyMessage";
import { buildVisitorConfirmationEmail } from "@/features/contact/templates/visitorConfirmation";

/**
 * The two contact emails. The company email carries visitor input and must escape it; the
 * visitor email must carry none, because the address it goes to is chosen by a stranger.
 */

const HOSTILE = {
  name: `<script>alert("n")</script> & Co`,
  email: `x"><img src=x onerror=alert(1)>@example.com`,
  message: `<b onmouseover="alert(2)">hi</b>\nsecond line & more`,
};

describe("buildCompanyMessageEmail", () => {
  it("puts the name, email and message in the subject and plain text", () => {
    const content = buildCompanyMessageEmail({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Line one\nLine two",
    });

    expect(content.subject).toBe("Website contact: Ada Lovelace");
    expect(content.text).toContain("Name:  Ada Lovelace");
    expect(content.text).toContain("Email: ada@example.com");
    expect(content.text).toContain("Line one\nLine two");
  });

  it("escapes every visitor value in the HTML body", () => {
    const { html } = buildCompanyMessageEmail(HOSTILE);

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b onmouseover");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; Co");
    expect(html).toContain("second line &amp; more");
  });
});

describe("buildVisitorConfirmationEmail", () => {
  it("promises a reply within the shared response time", () => {
    const { text } = buildVisitorConfirmationEmail();

    expect(text).toContain(`within ${INQUIRY_RESPONSE_HOURS} hours`);
    expect(text).toContain("received your message");
  });

  it("takes no visitor input, so none can appear in it", () => {
    // The builder's signature accepts only the company's own address.
    expect(buildVisitorConfirmationEmail.length).toBeLessThanOrEqual(1);

    const content = buildVisitorConfirmationEmail({ replyToAddress: "hello@peptologics.com" });
    const everything = `${content.subject}${content.text}${content.html}`;

    expect(everything).not.toContain("Ada");
    expect(everything).toContain("hello@peptologics.com");
  });

  it("is identical every time", () => {
    expect(buildVisitorConfirmationEmail()).toEqual(buildVisitorConfirmationEmail());
  });

  it("drops the address sentence rather than rendering an empty one", () => {
    const { text, html } = buildVisitorConfirmationEmail();

    expect(text).toContain("simply reply to this email");
    expect(html).not.toContain("mailto:");
  });

  it("carries the research-use footer", () => {
    expect(buildVisitorConfirmationEmail().text).toContain("laboratory research use only");
  });
});
