// ============================================
// lib/format/money.ts - money display formatting
// ============================================
// Money crosses the API as an integer count of the currency's MINOR unit
// (sen for MYR) plus an ISO 4217 code. These helpers are the one sanctioned
// way to render it in every app (web, merchant, admin) — never divide by 100
// by hand, since not every currency has two minor digits.
//
// The minor-unit exponent comes from `SALE_CURRENCY_MINOR_UNIT_EXPONENTS` in
// @workspace/shared (ISO 4217), never from ICU: `Intl`'s default fraction
// digits are a display convention that differs from ISO 4217 for several
// currencies. The locale is a required argument — there is no implicit
// runtime default, so server and browser render the same string.

import { SALE_CURRENCY_MINOR_UNIT_EXPONENTS, type SaleCurrency } from "@workspace/shared";
import { normalizeIntlSpacing } from "./intl-text";

/** Base of the decimal system — a currency with `n` minor digits has 10^n minor units per major unit. */
const DECIMAL_BASE = 10;

/** At most one decimal on compact amounts ("RM 12.3K"). */
const COMPACT_FRACTION_DIGITS = 1;

/** Separates the parts of a formatter cache key; never occurs in a locale tag or an ISO 4217 code. */
const CACHE_KEY_SEPARATOR = "|";

const standardFormatters = new Map<string, Intl.NumberFormat>();
const compactFormatters = new Map<string, Intl.NumberFormat>();

function standardFormatter(currency: SaleCurrency, locale: string): Intl.NumberFormat {
	const key = `${locale}${CACHE_KEY_SEPARATOR}${currency}`;
	const cached = standardFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const exponent = minorUnitExponent(currency);
	const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent });
	standardFormatters.set(key, formatter);
	return formatter;
}

function compactFormatter(currency: SaleCurrency, locale: string): Intl.NumberFormat {
	const key = `${locale}${CACHE_KEY_SEPARATOR}${currency}`;
	const cached = compactFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
		notation: "compact",
		maximumFractionDigits: COMPACT_FRACTION_DIGITS,
	});
	compactFormatters.set(key, formatter);
	return formatter;
}

/** ISO 4217 minor-unit exponent of `currency` (2 for MYR) — from the shared table, never from ICU. */
export function minorUnitExponent(currency: SaleCurrency): number {
	return SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency];
}

/** Converts an amount in minor units to major units (`123450` sen → `1234.5` ringgit). */
export function minorToMajorUnits(minor: number, currency: SaleCurrency): number {
	return minor / DECIMAL_BASE ** minorUnitExponent(currency);
}

/** `123450, "MYR", "en-MY"` → `"RM 1,234.50"` — full precision (the currency's minor digits), for values and tooltips. */
export function formatMinorUnits(minor: number, currency: SaleCurrency, locale: string): string {
	return normalizeIntlSpacing(standardFormatter(currency, locale).format(minorToMajorUnits(minor, currency)));
}

/** `12345678, "MYR", "en-MY"` → `"RM 123.5K"` — abbreviated, for chart axes and tight spaces. */
export function formatMinorUnitsCompact(minor: number, currency: SaleCurrency, locale: string): string {
	return normalizeIntlSpacing(compactFormatter(currency, locale).format(minorToMajorUnits(minor, currency)));
}
