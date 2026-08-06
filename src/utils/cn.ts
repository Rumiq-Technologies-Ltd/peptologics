import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, resolving conflicting Tailwind utilities in favour of the
 * last one. Required by shadcn/ui components and used throughout for variant
 * overrides via props.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
