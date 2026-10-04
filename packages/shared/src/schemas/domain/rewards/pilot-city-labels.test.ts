import { describe, expect, it } from "vitest";

import { PILOT_CITY_LABELS, PilotCitySchema } from "./rewards-enums";

describe("PILOT_CITY_LABELS", () => {
	it("has a non-blank display name for exactly the pilot cities", () => {
		expect(Object.keys(PILOT_CITY_LABELS).sort()).toEqual([...PilotCitySchema.options].sort());
		for (const city of PilotCitySchema.options) {
			expect(PILOT_CITY_LABELS[city].trim()).not.toBe("");
		}
	});

	it("names each city as it is written on signage", () => {
		expect(PILOT_CITY_LABELS.KUALA_LUMPUR).toBe("Kuala Lumpur");
		expect(PILOT_CITY_LABELS.MELAKA).toBe("Melaka");
	});
});
