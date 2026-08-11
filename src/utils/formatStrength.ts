import type { StrengthUnit } from "@/features/products/types/product";

/**
 * Vial strength formatting.
 *
 * Strengths are stored as `numeric` so a future sub-milligram product needs no
 * migration. Display drops meaningless trailing zeros: 10 not 10.0.
 *
 * The unit is a parameter with an `mg` default rather than a hardcoded suffix. Every
 * peptide in the catalog is milligrams, but the diluent is millilitres, and a default
 * keeps the twelve existing call sites unchanged while making the thirteenth correct.
 */

const strengthFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

/** Millilitres take a capital L, the SI convention that distinguishes it from a one. */
function unitLabel(unit: StrengthUnit): string {
  return unit === "ml" ? "mL" : "mg";
}

/** `10` -> "10 mg". `0.5` -> "0.5 mg". `10, "ml"` -> "10 mL". */
export function formatStrength(amount: number, unit: StrengthUnit = "mg"): string {
  return `${strengthFormatter.format(amount)} ${unitLabel(unit)}`;
}

/** Compact form for dense table columns and product codes. `10` -> "10mg". */
export function formatStrengthCompact(amount: number, unit: StrengthUnit = "mg"): string {
  return `${strengthFormatter.format(amount)}${unitLabel(unit)}`;
}

/** The line under a product name in the catalog: "10mg/vial · single vial". */
export function formatVialLabel(amount: number, unit: StrengthUnit = "mg"): string {
  return `${formatStrengthCompact(amount, unit)}/vial · single vial`;
}
