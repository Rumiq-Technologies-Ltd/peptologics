import type { RebuildOutcome } from "@/features/admin/products/services/rebuild.service";
import type { AdminProduct } from "@/features/admin/products/types";

/** What every product server action returns to the form or list. Plain data, safe for the browser. */
export type ProductActionResult =
  | {
      success: true;
      message: string;
      product?: AdminProduct;
      rebuild?: RebuildOutcome;
    }
  | {
      success: false;
      message: string;
      code: "VALIDATION_FAILED" | "VERSION_CONFLICT" | "SLUG_TAKEN" | "NOT_FOUND" | "ERROR";
      fieldErrors?: Record<string, string[]>;
    };

/** The shown text for a build request that followed a create or slug change. */
export function messageForRebuild(outcome: RebuildOutcome): string {
  switch (outcome) {
    case "triggered":
      return "Saved. The product page goes live in about 5 minutes.";
    case "skipped":
      return "Saved. No site build is requested in this environment.";
    case "deferred":
    case "failed":
      return "Saved. The page will go live after the next deploy.";
  }
}
