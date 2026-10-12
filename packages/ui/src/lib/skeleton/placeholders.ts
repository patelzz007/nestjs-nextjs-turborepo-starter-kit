/**
 * Helpers for building loading skeletons — shared by the kit's patterns and
 * every app's own skeleton compositions, so none of them re-derive these.
 */

/** `count` stable React keys for placeholder bones (`row-0`, `row-1`, …) — placeholders never reorder, so the position is the identity. */
export function placeholderKeys(prefix: string, count: number): readonly string[] {
	return Array.from({ length: count }, (_, index): string => `${prefix}-${String(index)}`);
}

/**
 * The `index`-th width class of a cycle, so a column of bones reads like
 * ragged real copy and neighbours never share a width. `fallback` covers an
 * empty cycle.
 */
export function cycledWidth(widths: readonly string[], index: number, fallback = "w-full"): string {
	return widths[index % widths.length] ?? fallback;
}
