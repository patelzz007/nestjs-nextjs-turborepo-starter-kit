import { describe, expect, it } from "vitest";

import { ANALYTICS_BUCKET_DISPLAY_REGION } from "./analytics";
import { SALE_CURRENCY_MINOR_UNIT_EXPONENTS, SaleCurrencySchema } from "./rewards-entities";
import { PILOT_CITY_TIME_ZONES, PilotCitySchema, PLATFORM_DISPLAY_REGION } from "./rewards-enums";

/** ISO 4217 minor-unit exponents, transcribed from the standard's currency table. */
const ISO_4217_MINOR_UNITS: Readonly<Record<string, number>> = { MYR: 2 };

describe("SALE_CURRENCY_MINOR_UNIT_EXPONENTS", () => {
	it("holds the ISO 4217 exponent of every sale currency", () => {
		for (const currency of SaleCurrencySchema.options) {
			expect(SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency]).toBe(ISO_4217_MINOR_UNITS[currency]);
		}
	});

	it("has an entry for exactly the sale currencies", () => {
		expect(Object.keys(SALE_CURRENCY_MINOR_UNIT_EXPONENTS).sort()).toEqual([...SaleCurrencySchema.options].sort());
	});
});

describe("PLATFORM_DISPLAY_REGION", () => {
	it("is a canonical locale and a real IANA time zone", () => {
		expect(Intl.getCanonicalLocales(PLATFORM_DISPLAY_REGION.locale)).toEqual([PLATFORM_DISPLAY_REGION.locale]);
		expect(new Intl.DateTimeFormat(PLATFORM_DISPLAY_REGION.locale, { timeZone: PLATFORM_DISPLAY_REGION.timeZone }).resolvedOptions().timeZone).toBe(
			PLATFORM_DISPLAY_REGION.timeZone,
		);
	});

	it("is the time zone of every pilot city, so platform time is every store's wall-clock time", () => {
		// A pilot city in another zone breaks the single-region decision: times would then have to be shown in the store's own zone.
		for (const city of PilotCitySchema.options) {
			expect(PILOT_CITY_TIME_ZONES[city]).toBe(PLATFORM_DISPLAY_REGION.timeZone);
		}
	});
});

describe("ANALYTICS_BUCKET_DISPLAY_REGION", () => {
	it("names a UTC week bucket by its UTC calendar day, in the platform locale", () => {
		expect(ANALYTICS_BUCKET_DISPLAY_REGION).toEqual({ locale: PLATFORM_DISPLAY_REGION.locale, timeZone: "UTC" });
	});
});
