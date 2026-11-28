import type { AdminNotification, AdminOrder, AdminOrderLine } from "@/features/admin/orders/types";
import { formatCurrencyExact } from "@/utils/formatCurrency";

import { LocalTime } from "./LocalTime";

const CARD = "border-ink-200 rounded-lg border bg-white p-5";
const HEADING = "text-ink-950 text-base font-semibold";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-ink-600 text-sm">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}

/** What the customer entered. Read-only: orders are completed outside the site (D41). */
export function OrderCustomerCard({ order }: { order: AdminOrder }) {
  const cityLine = [order.city, order.state, order.zipCode].filter(Boolean).join(", ");

  return (
    <section className={CARD} aria-labelledby="order-customer">
      <h2 id="order-customer" className={HEADING}>
        Customer
      </h2>
      <dl className="divide-ink-100 mt-2 divide-y">
        <Row label="Name">{order.customerName}</Row>
        <Row label="Email">
          <a className="text-primary underline underline-offset-4" href={`mailto:${order.email}`}>
            {order.email}
          </a>
        </Row>
        <Row label="Phone">
          <a
            className="text-primary underline underline-offset-4"
            href={`tel:${order.phone.replace(/[^\d+]/g, "")}`}
          >
            {order.phone}
          </a>
        </Row>
        <Row label="Shipping address">
          <address className="not-italic">
            {order.address}
            {order.apartment ? <br /> : null}
            {order.apartment}
            <br />
            {cityLine}
            <br />
            {order.country}
          </address>
        </Row>
        <Row label="Customer's notes">
          {order.customerNotes ? (
            <span className="whitespace-pre-wrap">{order.customerNotes}</span>
          ) : (
            <span className="text-ink-600">None</span>
          )}
        </Row>
        <Row label="Research-use acknowledged">
          {order.ruoAcknowledgedAt ? (
            <LocalTime value={order.ruoAcknowledgedAt} />
          ) : (
            <span className="text-ink-600">Not recorded</span>
          )}
        </Row>
      </dl>
    </section>
  );
}

/** The lines and the totals exactly as the customer saw them. */
export function OrderLinesCard({ order, lines }: { order: AdminOrder; lines: AdminOrderLine[] }) {
  return (
    <section className={CARD} aria-labelledby="order-lines">
      <h2 id="order-lines" className={HEADING}>
        Items
      </h2>
      <div
        role="region"
        aria-label="Order items table"
        tabIndex={0}
        className="mt-3 overflow-x-auto"
      >
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Items in this order</caption>
          <thead className="border-ink-200 text-ink-600 border-b text-xs uppercase">
            <tr>
              <th scope="col" className="py-2 pr-3">
                Product
              </th>
              <th scope="col" className="py-2 pr-3">
                Strength
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Qty
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Unit price
              </th>
              <th scope="col" className="py-2 text-right">
                Line total
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.productId} className="border-ink-100 border-b last:border-0">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {line.productName}
                </th>
                <td className="py-2 pr-3">{line.strengthMg} mg</td>
                <td className="py-2 pr-3 text-right">{line.quantity}</td>
                <td className="py-2 pr-3 text-right">{formatCurrencyExact(line.unitPriceCents)}</td>
                <td className="py-2 text-right">{formatCurrencyExact(line.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-600">Subtotal</dt>
          <dd>{formatCurrencyExact(order.subtotalCents)}</dd>
        </div>
        {order.discountCents > 0 || order.couponCode ? (
          <div className="flex justify-between">
            <dt className="text-ink-600">
              Coupon{order.couponCode ? ` (${order.couponCode})` : ""}
            </dt>
            <dd>−{formatCurrencyExact(order.discountCents)}</dd>
          </div>
        ) : null}
        <div className="border-ink-200 flex justify-between border-t pt-1 font-semibold">
          <dt>Total</dt>
          <dd>{formatCurrencyExact(order.totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

const CHANNEL_LABELS: Record<AdminNotification["channel"], string> = {
  email: "Notification to the company",
  customer_email: "Confirmation to the customer",
};

const STATUS_TEXT: Record<AdminNotification["status"], string> = {
  sent: "Sent",
  failed: "Failed",
  pending: "Pending (not sent yet)",
  skipped: "Skipped (email is off on this site)",
};

/** Delivery facts for each email. Never the message itself. */
export function OrderEmailCard({ notifications }: { notifications: AdminNotification[] }) {
  return (
    <section className={CARD} aria-labelledby="order-email">
      <h2 id="order-email" className={HEADING}>
        Email status
      </h2>
      {notifications.length === 0 ? (
        <p className="text-ink-600 mt-2 text-sm">No email record for this order.</p>
      ) : (
        <ul className="divide-ink-100 mt-2 divide-y">
          {notifications.map((notification) => (
            <li key={notification.channel} className="py-2 text-sm">
              <p className="font-medium">{CHANNEL_LABELS[notification.channel]}</p>
              <p className="text-ink-700">
                {STATUS_TEXT[notification.status]}
                {" · "}
                {notification.attempts} {notification.attempts === 1 ? "attempt" : "attempts"}
                {" · "}
                <LocalTime value={notification.sentAt ?? notification.updatedAt} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
