import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { MINIMUM_AGE, SITE_NAME } from "@/constants/site";

/**
 * The full Research-Use-Only policy. Linked from the disclaimer gate, so it must
 * remain in GATE_EXEMPT_ROUTES — a visitor has to be able to read this before
 * accepting it.
 *
 * TODO(legal): counsel review required before launch. This is professional,
 * claim-free drafting, not legal advice. Open question 9 in docs/decisions.md.
 */
export const metadata: Metadata = {
  title: "Research-Use-Only Policy",
  description:
    "All PeptoLogics products are supplied for in-vitro laboratory research use only, are not for human or animal consumption, and are not approved for therapeutic use.",
  alternates: { canonical: ROUTES.researchUseOnly },
};

export default function ResearchUseOnlyPage() {
  return (
    <article>
      <p className="text-eyebrow text-brand-800 uppercase">Compliance</p>
      <h1 className="mt-3">Research-Use-Only Policy</h1>

      <p>
        This policy governs the supply and intended use of every product listed by {SITE_NAME}. It
        applies to all visitors and all purchasers, without exception.
      </p>

      <h2>What we supply</h2>
      <p>
        {SITE_NAME} supplies lyophilized peptide compounds intended exclusively for laboratory and
        in-vitro research conducted by qualified professionals. Our products are chemical reagents.
        They are not drugs, not dietary supplements, not cosmetics, and not medical devices.
      </p>

      <h2>Not for human or animal use</h2>
      <p>
        Our products are not for human or animal consumption. They must not be administered to
        humans or animals by any route, and must not be used in any diagnostic or therapeutic
        procedure.
      </p>
      <p>
        No product listed on this website has been approved by the United States Food and Drug
        Administration, or by any comparable authority, for therapeutic
        use.
      </p>

      <h2>We are not a pharmacy</h2>
      <p>
        {SITE_NAME} is not a pharmacy, a compounding facility, or a healthcare provider. We do not
        and will not provide:
      </p>
      <ul>
        <li>Dosing information, protocols, or administration guidance of any kind</li>
        <li>Medical, clinical, veterinary, or nutritional advice</li>
        <li>Diluents, bacteriostatic water, syringes, needles, or any administration materials</li>
        <li>Any recommendation to purchase or use any product for any purpose</li>
      </ul>
      <p>
        Requests for any of the above will not be answered. This is not a matter of policy
        preference; providing them would be inconsistent with the research-only basis on which these
        products are supplied.
      </p>

      <h2>Who we are able to supply</h2>
      <p>To purchase from {SITE_NAME} you must:</p>
      <ol>
        <li>Be at least {MINIMUM_AGE} years of age.</li>
        <li>
          Be a qualified researcher, or be purchasing on behalf of a licensed research institution
          or business, for lawful laboratory use only.
        </li>
        <li>
          Hold any licence, registration, or institutional approval that applies to you in your
          jurisdiction.
        </li>
      </ol>
      <p>
        You are solely responsible for determining and complying with the laws, regulations, and
        institutional requirements that apply where you are. We cannot advise you on them.
      </p>

      <h2>Handling and storage</h2>
      <p>
        Products are supplied as lyophilized powder in sealed vials. Handle them as laboratory
        reagents, using appropriate personal protective equipment and containment for your setting.
        Storage conditions are stated on the Certificate of Analysis supplied with your order.
      </p>

      <h2>Analytical documentation</h2>
      <p>
        A Certificate of Analysis is available for production lots on request. A Certificate of
        Analysis applies only to the specific lot it identifies. Independent verification remains
        the responsibility of the purchaser.
      </p>

      <h2>Pricing and orders</h2>
      <p>
        Pricing shown on this website is indicative list pricing. This website does not process
        payments. Availability, lot documentation, and final pricing are confirmed by a
        representative before any transaction takes place.
      </p>

      <h2>Acknowledgement</h2>
      <p>
        Access to this website is conditional on acknowledging this policy. If you do not accept it,
        you must not use this website. See also our <a href={ROUTES.terms}>Terms of Use</a> and{" "}
        <a href={ROUTES.privacy}>Privacy Policy</a>.
      </p>
    </article>
  );
}
