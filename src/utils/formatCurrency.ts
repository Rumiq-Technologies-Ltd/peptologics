import { CURRENCY } from "@/constants/business";

/**
 * Money formatting.
 *
 * All prices are stored as integer cents (see docs/decisions.md, ADR-002), so
 * every formatter here takes cents and divides once at the display boundary.
 */

const wholeDollarFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const centsFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats integer cents as currency, dropping ".00" for whole amounts.
 *
 * The catalog is all whole dollars, and "$60" reads far cleaner in a dense table
 * than "$60.00". Any amount with cents still shows them.
 */
export function formatCurrency(cents: number): string {
  const isWholeDollar = cents % 100 === 0;
  const dollars = cents / 100;

  return isWholeDollar ? wholeDollarFormatter.format(dollars) : centsFormatter.format(dollars);
}

/** Always shows two decimal places. For subtotals and email templates. */
export function formatCurrencyExact(cents: number): string {
  return centsFormatter.format(cents / 100);
}

const perMgFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a cost-per-milligram value.
 *
 * Two decimals matches the source price list. Note this rounds — K-L-O-W's true
 * value is 1.125/mg and displays as $1.13, which is the intended behaviour.
 */
export function formatCostPerMg(costPerMg: number): string {
  return `${perMgFormatter.format(costPerMg)}/mg`;
}
