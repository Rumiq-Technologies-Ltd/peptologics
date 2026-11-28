import type { AdminProduct } from "@/features/admin/products/types";

/** What every product server action returns to the form or list. Plain data, safe for the browser. */
export type ProductActionResult =
  | {
      success: true;
      message: string;
      product?: AdminProduct;
    }
  | {
      success: false;
      message: string;
      code: "VALIDATION_FAILED" | "VERSION_CONFLICT" | "SLUG_TAKEN" | "NOT_FOUND" | "ERROR";
      fieldErrors?: Record<string, string[]>;
    };
