/** The most months the list will read back, so "Load older" always ends. */
export const MAX_MONTHS = 60;
/** Months the home page counts new orders across (D41 plan, owner-approved). */
export const NEW_ORDER_COUNT_MONTHS = 12;

/** UTC `yyyy-mm` strings, the current month first, going back `count` months. */
export function recentMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();

  for (let index = 0; index < count; index += 1) {
    months.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return months;
}
