// The bill the cashier types at checkout, in the currency's major units
// ("25", "25.5", "1,234.50"), to and from the integer minor units the API
// takes (sen for MYR). The minor-unit exponent comes from the shared ISO 4217
// table, never from Intl (see SALE_CURRENCY_MINOR_UNIT_EXPONENTS).

import { MAX_BILL_TOTAL_MINOR, PLATFORM_DISPLAY_REGION, SALE_CURRENCY_MINOR_UNIT_EXPONENTS, type SaleCurrency } from "@workspace/shared";

/** Base of the decimal system — a currency with `n` minor digits has 10^n minor units per major unit. */
const DECIMAL_BASE = 10;

/** Digits, then at most one decimal point and its digits: "25", "25.", "25.50", ".5". */
const AMOUNT_PATTERN = /^(?<whole>\d*)(?:\.(?<fraction>\d*))?$/u;

/** Grouping separators a cashier may type ("1,234.50", "1 234.50"). */
const GROUPING_PATTERN = /[,\s]/gu;

/**
 * The amount typed, in minor units — `null` when it is not an amount: empty,
 * not a number, more decimals than the currency has, or over the largest bill
 * the API accepts.
 */
export function parseBillAmount(text: string, currency: SaleCurrency): number | null {
	const groups = AMOUNT_PATTERN.exec(text.trim().replace(GROUPING_PATTERN, ""))?.groups;
	const whole = groups?.whole ?? "";
	const fraction = groups?.fraction ?? "";
	const exponent = SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency];
	if (groups === undefined || (whole.length === 0 && fraction.length === 0) || fraction.length > exponent) {
		return null;
	}
	const minor = Number(whole.length === 0 ? "0" : whole) * DECIMAL_BASE ** exponent + Number(fraction.padEnd(exponent, "0"));
	return Number.isSafeInteger(minor) && minor <= MAX_BILL_TOTAL_MINOR ? minor : null;
}

const formatters = new Map<SaleCurrency, Intl.NumberFormat>();

/** `2550, "MYR"` → `"RM 25.50"`, in the platform's display locale. */
export function formatBillAmount(minor: number, currency: SaleCurrency): string {
	const exponent = SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency];
	let formatter = formatters.get(currency);
	if (formatter === undefined) {
		formatter = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { style: "currency", currency, minimumFractionDigits: exponent, maximumFractionDigits: exponent });
		formatters.set(currency, formatter);
	}
	return formatter.format(minor / DECIMAL_BASE ** exponent);
}
