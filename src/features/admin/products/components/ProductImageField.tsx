"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { LoaderCircleIcon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  finalizeImageUploadAction,
  requestImageUploadAction,
} from "@/features/admin/products/actions/productActions";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isAllowedImageType,
} from "@/features/admin/products/utils/imageRules";

interface ProductImageFieldProps {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  productName: string;
  /** False when no media bucket is configured: upload is hidden and the current image is shown. */
  uploadEnabled: boolean;
}

/**
 * Picks an image, sends it straight to S3 with a presigned URL, then asks the server to check and
 * convert it. The checks here (type, size) only save a round trip: the server repeats them, and
 * also checks the dimensions and re-encodes the file.
 */
export function ProductImageField({
  value,
  onChange,
  productName,
  uploadEnabled,
}: ProductImageFieldProps) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File): Promise<void> {
    setError(null);

    if (!isAllowedImageType(file.type)) return setError("Use a JPEG, PNG or WebP image.");
    if (file.size > MAX_IMAGE_BYTES) return setError("The image must be 5 MB or smaller.");

    setBusy(true);
    try {
      const ticket = await requestImageUploadAction({ contentType: file.type, size: file.size });
      if (!ticket.success) return setError(ticket.message);

      // The browser sets Content-Length itself from the body; the signature already covers it.
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) return setError("The upload did not go through. Please try again.");

      const finalized = await finalizeImageUploadAction(ticket.key);
      if (!finalized.success) return setError(finalized.message);

      onChange(finalized.imageUrl);
    } catch {
      setError("The upload did not go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium">Photo</p>
      <div className="mt-2 flex items-start gap-4">
        <div className="bg-ink-200 relative size-28 shrink-0 overflow-hidden rounded-md">
          {value ? (
            <Image
              src={value}
              alt={`Photo of ${productName || "the product"}`}
              fill
              sizes="112px"
              className="object-cover"
            />
          ) : null}
        </div>

        <div className="text-sm">
          {uploadEnabled ? (
            <>
              <input
                id={inputId}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void upload(file);
                }}
              />
              <Button asChild variant="outline" size="sm" aria-disabled={busy}>
                <label htmlFor={inputId} className="cursor-pointer">
                  {busy ? (
                    <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
                  ) : (
                    <UploadIcon aria-hidden="true" />
                  )}
                  {busy ? "Uploading…" : value ? "Replace photo" : "Upload photo"}
                </label>
              </Button>
              {value ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
                  Remove
                </Button>
              ) : null}
              <p className="text-ink-600 mt-2">
                JPEG, PNG or WebP, up to 5 MB. Square or nearly square, between 600 and 4000 pixels.
              </p>
            </>
          ) : (
            <p className="text-ink-600">Photo upload is not set up in this environment.</p>
          )}
          <p role="alert" className="mt-2 text-red-700">
            {error}
          </p>
        </div>
      </div>
    </div>
  );
}
