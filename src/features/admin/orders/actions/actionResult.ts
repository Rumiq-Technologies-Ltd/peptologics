import type { AdminOrder, AdminOrderNote } from "@/features/admin/orders/types";

/** What every order server action returns to the screen. Plain data, safe for the browser. */
export type OrderActionResult =
  | { success: true; message: string; order?: AdminOrder; note?: AdminOrderNote }
  | {
      success: false;
      message: string;
      code: "VALIDATION_FAILED" | "VERSION_CONFLICT" | "NOT_FOUND" | "ERROR";
      fieldErrors?: Record<string, string[]>;
    };
