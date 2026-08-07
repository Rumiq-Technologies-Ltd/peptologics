import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";

/**
 * Privacy Policy. Linked from the disclaimer gate, so it stays in
 * GATE_EXEMPT_ROUTES.
 *
 * TODO(legal): counsel review required. Two client decisions are still open and
 * marked inline: the retention period and whether analytics will be installed.
 * Open questions 14 and 16 in docs/decisions.md.
 */
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} collects, uses, and protects the information you provide with an inquiry.`,
  alternates: { canonical: ROUTES.privacy },
};

export default function PrivacyPage() {
  return (
    <article>
      <p className="text-eyebrow text-brand-800 uppercase">Legal</p>
      <h1 className="mt-3">Privacy Policy</h1>

      <p>
        This policy explains what information {SITE_NAME} collects, why, and what we do with it. We
        collect as little as possible and use it only to answer your inquiry.
      </p>

      <h2>What we collect</h2>
      <p>When you submit an inquiry, we collect only what we need to respond and to ship:</p>
      <ul>
        <li>Your name, email address, and phone number</li>
        <li>Your shipping address</li>
        <li>The products and quantities on your inquiry list</li>
        <li>Any notes you choose to add</li>
        <li>The date and time you acknowledged our Research-Use-Only policy</li>
      </ul>
      <p>
        We do not collect payment information anywhere on this website, because no payment is taken
        here.
      </p>

      <h2>Abuse prevention</h2>
      <p>
        To stop automated submissions filling our inbox, we count recent submissions per visitor. We
        do this using a one-way cryptographic hash of your IP address, salted with a secret only we
        hold. We do not store your IP address itself, and the hash cannot be reversed to recover it.
      </p>

      <h2>How we use it</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Respond to your inquiry and prepare a quotation</li>
        <li>Confirm availability and lot documentation</li>
        <li>Arrange payment and dispatch with you directly</li>
        <li>Keep a record of the transaction</li>
      </ul>
      <p>
        <strong>We do not sell your data.</strong> We do not share it with advertisers, data
        brokers, or anyone else for marketing. We will not add you to a marketing list because you
        submitted an inquiry.
      </p>

      <h2>Who else sees it</h2>
      <p>
        Only the service providers needed to operate the site and reach you, each acting on our
        instructions:
      </p>
      <ul>
        <li>Our hosting provider, which serves this website</li>
        <li>Our database provider, which stores your inquiry</li>
        <li>Our email provider, which delivers your inquiry to our team</li>
        <li>WhatsApp, if you choose to contact us that way</li>
      </ul>
      <p>
        We may also disclose information where the law requires it. Otherwise we will not disclose
        it.
      </p>

      <h2>How long we keep it</h2>
      {/* TODO(client): a definite retention period is needed. Open question 14. */}
      <p>
        We keep inquiry records for as long as needed to answer you, fulfil an order, and meet our
        record-keeping obligations. If you would like your information removed, contact us and we
        will do so unless we are required to retain it.
      </p>

      <h2>Cookies and analytics</h2>
      {/* TODO(client): revise if analytics is installed. Open question 16. */}
      <p>
        This website does not use advertising or tracking cookies. Your acknowledgement of our
        Research-Use-Only policy is stored in your browser&apos;s local storage on your own device,
        not sent to us, so you are not asked to accept it on every visit. Clearing your browser data
        removes it.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Contact
        us through the <a href={ROUTES.contact}>contact page</a> and we will respond.
      </p>

      <h2>Security</h2>
      <p>
        Traffic to this website is encrypted in transit. Inquiry records are stored in a database
        that is not publicly readable, and access is limited to what is needed to operate the
        service. No system is perfectly secure, but we do not collect more than we need, which is
        the most effective protection available.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. The version published here at the time you use the site is the
        version that applies.
      </p>
    </article>
  );
}
