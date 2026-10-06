// ============================================
// lib/format/country.ts - an ISO 3166-1 alpha-2 code for people
// ============================================
// Both helpers use only the platform: Unicode regional-indicator symbols for
// the flag, `Intl.DisplayNames` for the name. A code the CDN invents (Cloudflare's
// `T1` = Tor) has neither, and is shown as it is.

/** Unicode "REGIONAL INDICATOR SYMBOL LETTER A" — `A`…`Z` map onto it in order. */
const REGIONAL_INDICATOR_A = 0x1f1e6;
const LETTER_A = "A".charCodeAt(0);
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/** `MY` → 🇲🇾; `null` for anything that is not two letters. */
export function countryFlag(code: string): string | null {
	const upper: string = code.toUpperCase();
	if (!COUNTRY_CODE_PATTERN.test(upper)) {
		return null;
	}
	const regionalIndicator = (index: number): number => REGIONAL_INDICATOR_A + upper.charCodeAt(index) - LETTER_A;
	return String.fromCodePoint(regionalIndicator(0), regionalIndicator(1));
}

/** `MY` → `Malaysia` (in `locale`); the code itself when the platform does not know it. */
export function countryName(code: string, locale = "en"): string {
	try {
		return new Intl.DisplayNames([locale], { type: "region", fallback: "code" }).of(code.toUpperCase()) ?? code;
	} catch {
		// `Intl` rejects malformed region codes (e.g. "T1") with a RangeError.
		return code;
	}
}
