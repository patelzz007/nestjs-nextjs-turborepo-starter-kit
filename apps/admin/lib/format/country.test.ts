import { describe, expect, it } from "vitest";

import { countryFlag, countryName } from "./country";

describe("countryFlag", () => {
	it("builds the flag from the two regional-indicator letters", () => {
		expect(countryFlag("MY")).toBe("🇲🇾");
		expect(countryFlag("sg")).toBe("🇸🇬");
	});

	it("has no flag for a non-letter code (Cloudflare's T1 = Tor) or a malformed one", () => {
		expect(countryFlag("T1")).toBeNull();
		expect(countryFlag("MYS")).toBeNull();
		expect(countryFlag("")).toBeNull();
	});
});

describe("countryName", () => {
	it("names a known country", () => {
		expect(countryName("MY")).toBe("Malaysia");
		expect(countryName("sg")).toBe("Singapore");
	});

	it("falls back to the code itself", () => {
		expect(countryName("T1")).toBe("T1");
	});
});
