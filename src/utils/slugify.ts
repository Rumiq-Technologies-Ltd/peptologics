/**
 * URL-safe slug generation.
 *
 * Slugs in the database are authored, not generated — this exists for seeding
 * and for validating that an authored slug is well formed.
 */

/** Unicode combining diacritical marks, left over after NFKD normalisation. */
const COMBINING_MARKS = /[\u0300-\u036F]/g;

export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      // Strip diacritics so "Glutathïone" and "Glutathione" agree.
      .replace(COMBINING_MARKS, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** Lowercase alphanumerics separated by single hyphens, no leading or trailing hyphen. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
