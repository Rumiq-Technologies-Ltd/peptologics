"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Copies a value to the clipboard and says so.
 *
 * The value is always visible next to this button, so if the clipboard is blocked (an
 * insecure context, a denied permission) nothing is lost: the visitor can still select it.
 * The "Copied" confirmation goes through a live region, because a label change alone is
 * silent to a screen reader.
 */
export interface CopyButtonProps {
  value: string;
  /** What the button does, as a short verb phrase: "Copy ID". */
  label: string;
}

const CONFIRMATION_MS = 2000;

export function CopyButton({ value, label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard unavailable: the value is on screen to select by hand.
      return;
    }

    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), CONFIRMATION_MS);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {copied ? "Copied" : label}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
