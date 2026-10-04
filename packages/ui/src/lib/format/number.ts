// ============================================
// lib/format/number.ts - count formatting
// ============================================
// The one sanctioned way to render a plain count in every app — never call
// `toLocaleString()` without a locale, which follows the runtime's default
// (the Node server's and the viewer's browser's differ, so the server HTML and
// the first client render would disagree). Money has its own helpers in
// `money.ts`.

const countFormatters = new Map<string, Intl.NumberFormat>();

/** `1234567, "en-MY"` → `"1,234,567"` — a count with the given locale's digit grouping. */
export function formatCount(value: number, locale: string): string {
	const cached = countFormatters.get(locale);
	if (cached !== undefined) {
		return cached.format(value);
	}
	const formatter = new Intl.NumberFormat(locale);
	countFormatters.set(locale, formatter);
	return formatter.format(value);
}
