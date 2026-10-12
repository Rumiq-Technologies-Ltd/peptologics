import type { Product } from "@/features/products/types/product";

/**
 * Display predicates shared by every surface that renders a product.
 *
 * Extracted because the same two questions were being asked in four places — the
 * catalog row, the card, the product page and the inquiry list — and each answered
 * them slightly differently. One definition means the catalog and the detail page
 * cannot disagree about whether a figure is meaningful.
 */

/**
 * Whether cost per milligram means anything for this product.
 *
 * Two ways it does not:
 *
 * - **A blend.** The figure divides price by total milligrams across several
 *   peptides, so it is not comparable to a single compound's.
 * - **Not measured in milligrams.** Bacteriostatic water is 10 mL; dollars per
 *   milligram of a diluent is not a number anyone should be shown.
 */
export function hasComparableCostPerMg(product: Product): boolean {
  return !product.isBlend && product.strengthUnit === "mg";
}

/**
 * How the vial's contents are supplied, for the line under a product name.
 *
 * Peptides are lyophilized powder. A diluent is a solution, and calling it
 * lyophilized would be plainly wrong next to its own photograph.
 */
export function formatPresentation(product: Product): string {
  return product.strengthUnit === "ml" ? "solution" : "lyophilized";
}

/**
 * How the vial's contents are supplied, in the words the product page, its metadata and its
 * structured data all use. A volume product is a sterile solution; a peptide is a lyophilized
 * powder. One definition, so a search engine's copy of a vial cannot disagree with the page.
 *
 * `phrase` reads inside a sentence ("supplied as …"); `label` is the specification value.
 */
export function productForm(product: Product): { phrase: string; label: string } {
  return product.strengthUnit === "ml"
    ? { phrase: "a sterile solution", label: "Sterile solution" }
    : { phrase: "lyophilized powder", label: "Lyophilized powder" };
}
