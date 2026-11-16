import { MOBILE_RADII, MOBILE_TYPE_SCALE } from "@workspace/tokens";
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Tailwind's conflict rules, taught the phone's own type roles (`text-h1`, `text-body`, …) and radii
 * (`rounded-card`, …) from mobile.css (ADR 079). Without them `text-h4` reads as a text colour, so
 * `cn("text-h4 text-foreground")` would drop the size, and `rounded-card` would never override `rounded-xl`.
 */
const mergeClasses = extendTailwindMerge({
	extend: {
		theme: {
			text: Object.keys(MOBILE_TYPE_SCALE),
			radius: Object.keys(MOBILE_RADII),
		},
	},
});

/**
 * Joins class names and resolves Tailwind conflicts (the last utility wins), so
 * a caller's `className` overrides a component's own classes predictably. The
 * same helper as the web kit's `cn` (packages/ui/src/lib/core/utils.ts), plus the
 * phone's type roles and radii.
 */
export function cn(...inputs: ClassValue[]): string {
	return mergeClasses(clsx(inputs));
}
