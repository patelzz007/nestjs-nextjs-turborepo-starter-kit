// ============================================
// lib/format/numbers.ts - count display formatting
// ============================================
// Counts (bills, merchants, cities) render through this helper, never a bare
// `toLocaleString()`: the runtime's default locale differs between the server
// and the browser, which changes digit grouping and breaks hydration.

import { DISPLAY_LOCALE } from "@/lib/format/dates";

const COUNT_FORMATTER = new Intl.NumberFormat(DISPLAY_LOCALE, { maximumFractionDigits: 0 });

/** `1234567` → `"1,234,567"` in the display locale. */
export function formatCount(count: number): string {
	return COUNT_FORMATTER.format(count);
}

/** Decimal places of a displayed latitude/longitude (~11 m at the equator). */
export const COORDINATE_FRACTION_DIGITS = 4;

/** Shown for a coordinate the record does not have. */
export const MISSING_COORDINATE_LABEL = "—";

const COORDINATE_FORMATTER = new Intl.NumberFormat(DISPLAY_LOCALE, {
	minimumFractionDigits: COORDINATE_FRACTION_DIGITS,
	maximumFractionDigits: COORDINATE_FRACTION_DIGITS,
	useGrouping: false,
});

/** `3.139003` → `"3.1390"`; a missing value → `"—"`. */
export function formatCoordinate(value: number | null | undefined): string {
	return value === null || value === undefined ? MISSING_COORDINATE_LABEL : COORDINATE_FORMATTER.format(value);
}

/** `"3.1390, 101.6869"`, or `"—"` unless both values are present. */
export function formatCoordinatePair(latitude: number | null | undefined, longitude: number | null | undefined): string {
	if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
		return MISSING_COORDINATE_LABEL;
	}
	return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
}

/**
 * Fraction digits of a catalog amount — the scale of the `Decimal(18, 2)`
 * price columns. Catalog prices are major-unit decimals without a currency
 * (unlike POS money, which is minor units + ISO code; see `formatMinorUnits`).
 */
export const CATALOG_AMOUNT_FRACTION_DIGITS = 2;

const CATALOG_AMOUNT_FORMATTER = new Intl.NumberFormat(DISPLAY_LOCALE, {
	minimumFractionDigits: CATALOG_AMOUNT_FRACTION_DIGITS,
	maximumFractionDigits: CATALOG_AMOUNT_FRACTION_DIGITS,
});

/** Shown for an amount the record does not have. */
export const MISSING_AMOUNT_LABEL = "—";

/** `1234.5` → `"1,234.50"`; a missing amount → `"—"`. */
export function formatCatalogAmount(amount: number | null): string {
	return amount === null ? MISSING_AMOUNT_LABEL : CATALOG_AMOUNT_FORMATTER.format(amount);
}
