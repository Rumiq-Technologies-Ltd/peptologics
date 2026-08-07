import type { Metadata } from "next";

import { ROUTES } from "@/constants/routes";
import { SITE_NAME } from "@/constants/site";

/**
 * Shipping & Payment.
 *
 * Deliberately describes the *process* rather than quoting timescales, costs, or a
 * returns window, because none of those have been supplied. Inventing them would
 * create commitments the client has not agreed to.
 *
 * TODO(client): shipping cost and timescales, accepted payment methods, and a
 * returns window. Open questions 18 in docs/decisions.md. Each gap is marked below.
 */
export const metadata: Metadata = {
  title: "Shipping & Payment",
  description: `How orders are quoted, paid for, packed and dispatched by ${SITE_NAME}.`,
  alternates: { canonical: ROUTES.shipping },
};

export default function ShippingPage() {
  return (
    <article>
      <p className="text-eyebrow text-brand-800 uppercase">Ordering</p>
      <h1 className="mt-3">Shipping &amp; Payment</h1>

      <p>
        {SITE_NAME} does not take payment on this website. Everything is arranged directly with a
        representative after you submit an inquiry, which is what lets us confirm eligibility,
        availability and lot documentation before anything is charged.
      </p>

      <h2>How an order is placed</h2>
      <ol>
        <li>
          <strong>Submit an inquiry.</strong> Build a list, add your contact and shipping details,
          and send it. Nothing is charged at this point and no order is created.
        </li>
        <li>
          <strong>We reply with a quotation.</strong> A representative confirms availability, lot
          documentation, shipping cost, and the final total.
        </li>
        <li>
          <strong>You approve it.</strong> Payment is arranged directly with the representative.
        </li>
        <li>
          <strong>We dispatch.</strong> Your order is packed and sent with tracking.
        </li>
      </ol>

      <h2>Pricing</h2>
      <p>
        Prices on the catalog are indicative list prices per vial. They do not include shipping, and
        they are not a quotation. Cost per milligram is shown so you can compare value across vial
        sizes; we omit it for multi-peptide blends, where the figure is not comparable.
      </p>

      <h2>Payment</h2>
      {/* TODO(client): list the accepted payment methods. */}
      <p>
        Payment methods are confirmed with your quotation. No payment details are ever entered on
        this website, and we never ask for them by email.
      </p>

      <h2>Packing and handling</h2>
      <p>
        Products are supplied as lyophilized powder in sealed vials, packed in tamper-evident
        packaging with temperature-controlled materials appropriate to the shipment. Storage
        conditions are stated on the Certificate of Analysis.
      </p>

      <h2>Shipping times and costs</h2>
      {/* TODO(client): real timescales and costs are needed here before launch. */}
      <p>
        Shipping cost and expected transit time are confirmed in your quotation, since both depend
        on the destination and the size of the order. Every shipment is tracked and you will receive
        the tracking reference on dispatch.
      </p>

      <h2>Damaged, incorrect or missing items</h2>
      {/* TODO(client): confirm the reporting window. */}
      <p>
        Inspect your shipment on arrival. If anything is damaged, incorrect, or missing, contact us
        promptly with your order number and we will put it right.
      </p>

      <h2>Returns</h2>
      <p>
        Given the nature of these materials, returns are limited: once a vial has left our control
        we cannot verify its storage conditions, so we cannot resupply it to anyone else. This is a
        product-integrity constraint rather than a commercial one. See our{" "}
        <a href={ROUTES.terms}>Terms of Use</a>.
      </p>

      <h2>Questions</h2>
      <p>
        Ask before you order rather than after — a representative would far rather answer a question
        up front. Reach us through the <a href={ROUTES.contact}>contact page</a>.
      </p>
    </article>
  );
}
