import { describe, expect, it } from "vitest";

import {
  MAX_NOTE_LENGTH,
  noteBodySchema,
  orderStatusSchema,
} from "@/features/admin/orders/validation/order.schema";

describe("noteBodySchema", () => {
  it("cleans invisible characters and trims, keeping line breaks", () => {
    const parsed = noteBodySchema.parse("  Called​ him \r\n\r\n\r\n\r\nNo answer  ");
    expect(parsed).toBe("Called him\n\nNo answer");
  });

  it("rejects an empty or whitespace-only note", () => {
    expect(noteBodySchema.safeParse("   ​ \n").success).toBe(false);
  });

  it("allows exactly the maximum and rejects one more", () => {
    expect(noteBodySchema.safeParse("a".repeat(MAX_NOTE_LENGTH)).success).toBe(true);
    expect(noteBodySchema.safeParse("a".repeat(MAX_NOTE_LENGTH + 1)).success).toBe(false);
  });

  it("stores markup as plain text, untouched (React escapes it on display)", () => {
    expect(noteBodySchema.parse("<b>hi</b>")).toBe("<b>hi</b>");
  });
});

describe("orderStatusSchema", () => {
  it("accepts the five statuses only", () => {
    for (const status of ["new", "contacted", "confirmed", "cancelled", "completed"]) {
      expect(orderStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(orderStatusSchema.safeParse("shipped").success).toBe(false);
  });
});
