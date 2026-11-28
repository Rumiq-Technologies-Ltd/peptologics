"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ArchiveProductDialogProps {
  productName: string | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirms an archive. Nothing is deleted: the product is hidden and can be restored (D37). */
export function ArchiveProductDialog({
  productName,
  pending,
  onConfirm,
  onCancel,
}: ArchiveProductDialogProps) {
  return (
    <Dialog open={productName !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {productName}?</DialogTitle>
          <DialogDescription>
            It will disappear from the shop, the sitemap and search straight away. Nothing is
            deleted: you can restore it from the Archived filter at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Archiving…" : "Archive product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
