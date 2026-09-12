import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes, resolving conflicts in favour of the last one.
 * Lets a component define defaults that a caller's `className` can override
 * (`cn("p-4", "p-6")` -> "p-6", rather than both landing in the class list).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
