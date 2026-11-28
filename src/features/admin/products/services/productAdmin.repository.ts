import type { Item } from "@/lib/dynamodb/entities";

/** What the admin product service needs from storage, with no AWS in sight. */

/** Why a write was refused. The service turns each into a message staff can act on. */
export type ConflictKind = "version" | "slug_taken" | "exists";

export class ProductWriteConflict extends Error {
  constructor(readonly kind: ConflictKind) {
    super(`Product write refused: ${kind}`);
    this.name = "ProductWriteConflict";
  }
}

/** One put in the transaction, with the condition that guards it. */
export interface WriteStep {
  item: Item;
  condition?: {
    expression: string;
    names?: Record<string, string>;
    values?: Record<string, unknown>;
  };
  /** What a failed condition on this step means. Defaults to "exists". */
  onConflict?: ConflictKind;
}

/** DynamoDB's own limit on items in one transaction. */
export const MAX_TRANSACTION_ITEMS = 100;

export interface ProductAdminRepository {
  listItems(): Promise<Item[]>;
  getItem(productId: string): Promise<Item | null>;
  commit(steps: readonly WriteStep[]): Promise<void>;
}
