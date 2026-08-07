import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { MINIMUM_AGE, SITE_NAME } from "@/constants/site";

/**
 * Terms of Use. Linked from the disclaimer gate, so it stays in
 * GATE_EXEMPT_ROUTES — a visitor must be able to read it before accepting it.
 *
 * TODO(legal): counsel review required before launch. Professional drafting, not
 * legal advice. Open question 9 in docs/decisions.md.
 */
export const metadata: Metadata = {
  title: "Terms of Use",
  description: `The terms governing use of ${SITE_NAME}.com and the supply of research compounds.`,
  alternates: { canonical: ROUTES.terms },
};

export default function TermsPage() {
  return (
    <article>
      <p className="text-eyebrow text-brand-800 uppercase">Legal</p>
      <h1 className="mt-3">Terms of Use</h1>

      <p>
        These terms govern your use of {SITE_NAME}.com. By accessing this website you agree to them.
        If you do not, you must not use the site.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least {MINIMUM_AGE} years of age and either a qualified researcher or acting
        on behalf of a licensed research institution or business. You are responsible for holding
        any licence, registration, or institutional approval that applies to you.
      </p>

      <h2>2. Research use only</h2>
      <p>
        Every product listed is supplied for in-vitro laboratory research use only. Products are not
        for human or animal consumption and are not approved for therapeutic use. Our full{" "}
        <a href={ROUTES.researchUseOnly}>Research-Use-Only Policy</a> forms part of these terms.
      </p>
      <p>
        You agree not to resell, redistribute, or supply any product for human or animal use, and
        not to represent any product as suitable for such use.
      </p>

      <h2>3. No medical advice</h2>
      <p>
        Nothing on this website is medical, clinical, veterinary, or scientific advice, or a
        recommendation to purchase or use any product. {SITE_NAME} is not a pharmacy and does not
        provide dosing or administration guidance.
      </p>

      <h2>4. Inquiries, pricing and orders</h2>
      <p>
        This website does not process payments and does not conclude a sale. Submitting an inquiry
        is a request for a quotation, not an order, and does not create a binding contract.
      </p>
      <p>
        Pricing shown is indicative list pricing and may change. Availability, lot documentation and
        final pricing are confirmed by a representative before any transaction. We may decline any
        inquiry at our discretion, including where we cannot satisfy ourselves as to eligibility.
      </p>

      <h2>5. Accuracy of information you provide</h2>
      <p>
        You agree that the information you submit is accurate and that you are authorised to submit
        it. Providing false eligibility information is a breach of these terms.
      </p>

      <h2>6. Shipping, returns and cancellations</h2>
      <p>
        Shipping arrangements are confirmed in your quotation. Given the nature of these materials,
        returns are limited. See <a href={ROUTES.shipping}>Shipping &amp; Payment</a> for current
        details.
      </p>
      {/* TODO(client): a returns window and shipping timescales are needed here.
          Open questions 18 in docs/decisions.md. */}
      <p>For damaged or incorrect items, contact us promptly on receipt so we can put it right.</p>

      <h2>7. Intellectual property</h2>
      <p>
        The {SITE_NAME} name, logo, site content and product listings are our property or used with
        permission. You may not copy or reuse them without written consent.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        Products are supplied for research use by qualified professionals, and you assume full
        responsibility for their handling, storage, and use in your setting. To the maximum extent
        permitted by law, {SITE_NAME} is not liable for any loss or damage arising from misuse of a
        product, from use outside laboratory research, or from failure to comply with applicable
        law.
      </p>
      <p>Nothing in these terms excludes liability that cannot lawfully be excluded.</p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. The version published on this page at the time you use the site
        is the version that applies.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these terms can be sent through our{" "}
        <a href={ROUTES.contact}>contact page</a>.
      </p>
    </article>
  );
}
