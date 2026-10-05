import { describe, expect, it } from "vitest";

import { formatEpochMsRange } from "./date-time";
import { normalizeIntlSpacing } from "./intl-text";

const ICU_SPACE_VARIANTS: readonly string[] = ["\u00A0", "\u2007", "\u2009", "\u200A", "\u202F"];
const NON_ASCII_SPACE = /[\u00A0\u2007\u2009\u200A\u202F]/;

describe("normalizeIntlSpacing", () => {
	it.each(ICU_SPACE_VARIANTS)("turns U+%s into a plain space", (variant) => {
		expect(normalizeIntlSpacing(`6 Sept${variant}–${variant}5 Oct 2026`)).toBe("6 Sept – 5 Oct 2026");
	});

	it("gives the same text whichever space variant the runtime's ICU used", () => {
		const renderings: readonly string[] = ["6 Sept – 5 Oct 2026", "6 Sept\u2009–\u20095 Oct 2026", "6 Sept\u202F–\u202F5 Oct 2026"];

		expect(new Set(renderings.map(normalizeIntlSpacing)).size).toBe(1);
	});
});

describe("shared formatters", () => {
	it("never emit an ICU-specific space (server and browser render identical text)", () => {
		const fromMs: number = Date.UTC(2026, 8, 5, 16);
		const toMs: number = Date.UTC(2026, 9, 5, 16);

		expect(formatEpochMsRange(fromMs, toMs, { locale: "en-MY", timeZone: "Asia/Kuala_Lumpur" })).not.toMatch(NON_ASCII_SPACE);
	});
});
