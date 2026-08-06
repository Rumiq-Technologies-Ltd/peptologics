/**
 * Vial strength formatting.
 *
 * Strengths are stored as `numeric` milligrams so a future sub-milligram product
 * needs no migration. Display drops meaningless trailing zeros: 10 not 10.0.
 */

const strengthFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

/** `10` -> "10 mg". `0.5` -> "0.5 mg". */
export function formatStrength(milligrams: number): string {
  return `${strengthFormatter.format(milligrams)} mg`;
}

/** Compact form for dense table columns and product codes. `10` -> "10mg". */
export function formatStrengthCompact(milligrams: number): string {
  return `${strengthFormatter.format(milligrams)}mg`;
}

/** The line under a product name in the catalog: "10mg/vial · single vial". */
export function formatVialLabel(milligrams: number): string {
  return `${formatStrengthCompact(milligrams)}/vial · single vial`;
}
