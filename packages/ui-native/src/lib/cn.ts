import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves Tailwind conflicts (the last utility wins), so
 * a caller's `className` overrides a component's own classes predictably. The
 * same helper as the web kit's `cn` (packages/ui/src/lib/core/utils.ts).
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
