// ============================================
// intl-text.ts — deterministic whitespace in Intl output
// ============================================
// `Intl` formatters take their spacing from the runtime's ICU/CLDR data, and
// different versions disagree: Node 24 (ICU 78) writes a date range as
// "6 Sept<U+2009>–<U+2009>5 Oct 2026" and a time as "10:00<U+202F>AM", while a
// browser on other locale data may use U+0020 or U+00A0 in the same places.
// Text rendered on the server and hydrated in the browser must be identical
// (otherwise React reports a hydration mismatch), so every shared formatter
// passes its output through `normalizeIntlSpacing`.

/**
 * The space characters ICU versions use interchangeably in formatted dates,
 * numbers and currencies: no-break, figure, thin, hair and narrow no-break spaces.
 */
const INTL_SPACE_VARIANTS = /[\u00A0\u2007\u2009\u200A\u202F]/g;

/** `text` with every ICU space variant replaced by a plain space (U+0020). */
export function normalizeIntlSpacing(text: string): string {
	return text.replace(INTL_SPACE_VARIANTS, " ");
}
