import { slugify } from "@/utils/slugify";

/**
 * The suggested web address: the name plus the vial size, as the catalog already does
 * (`bpc-157-10mg`, `pl3-30mg`). Staff can edit it; the schema and the database still check it.
 */
export function suggestProductSlug(
  name: string,
  strength: number | undefined,
  unit: string,
): string {
  const size =
    strength !== undefined && Number.isFinite(strength) && strength > 0 ? `${strength}${unit}` : "";
  return slugify(`${name} ${size}`);
}
