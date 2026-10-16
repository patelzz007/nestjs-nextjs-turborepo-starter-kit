// ============================================
// lib/format/bytes.ts - file size formatting
// ============================================
// The kit's one way to render a byte count ("0 bytes", "512 bytes", "1.5 kB",
// "2 MB"). Units step by 1024 (what file pickers and most OS dialogs mean by
// a kilobyte) and their names come from `Intl`, so they follow the locale.

import { normalizeIntlSpacing } from "./intl-text";

/** Bytes per step between units. */
const BYTES_PER_UNIT_STEP = 1024;

/** Default precision for the scaled value ("1.46 MB"). */
const DEFAULT_BYTES_FRACTION_DIGITS = 2;

/** Default locale — fixed (never the runtime's), so server and client render the same text. */
const DEFAULT_BYTES_LOCALE = "en";

/** Separates the parts of a formatter cache key; never occurs in a locale tag or unit name. */
const BYTES_CACHE_KEY_SEPARATOR = "|";

/** `Intl` sanctioned units, smallest first; the position is the power of 1024. */
const BYTE_UNITS: readonly ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"] = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"];

type ByteUnit = (typeof BYTE_UNITS)[number];

export interface FormatBytesOptions {
	/** BCP 47 locale for digits and unit names. Default `"en"`. */
	readonly locale?: string | undefined;
	/** Most decimals shown on the scaled value. Default 2. */
	readonly maximumFractionDigits?: number | undefined;
}

const bytesFormatters = new Map<string, Intl.NumberFormat>();

function bytesFormatter(locale: string, unit: ByteUnit, maximumFractionDigits: number): Intl.NumberFormat {
	const key = [locale, unit, String(maximumFractionDigits)].join(BYTES_CACHE_KEY_SEPARATOR);
	const cached = bytesFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		/* "0 bytes", not CLDR's short "0 byte"; the larger units read best short ("2 MB"). */
		unitDisplay: unit === "byte" ? "long" : "short",
		maximumFractionDigits,
	});
	bytesFormatters.set(key, formatter);
	return formatter;
}

/** `1536` → `"1.5 kB"`; `0` → `"0 bytes"` — a byte count in the largest unit that keeps it at or above 1. */
export function formatBytes(bytes: number, options: FormatBytesOptions = {}): string {
	const locale = options.locale ?? DEFAULT_BYTES_LOCALE;
	const maximumFractionDigits = options.maximumFractionDigits ?? DEFAULT_BYTES_FRACTION_DIGITS;
	const largestExponent = BYTE_UNITS.length - 1;
	const exponent = bytes < BYTES_PER_UNIT_STEP ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT_STEP)), largestExponent);
	const unit: ByteUnit = BYTE_UNITS.at(exponent) ?? "byte";
	const scaled = bytes / BYTES_PER_UNIT_STEP ** exponent;
	return normalizeIntlSpacing(bytesFormatter(locale, unit, maximumFractionDigits).format(scaled));
}
