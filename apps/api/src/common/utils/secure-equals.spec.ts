import { describe, expect, it } from "vitest";

import { secureEquals } from "./secure-equals";

describe("secureEquals", () => {
	it("returns true for identical strings", () => {
		expect(secureEquals("telescope-secret", "telescope-secret")).toBe(true);
	});

	it("returns false for different strings of the same length", () => {
		expect(secureEquals("telescope-secret", "telescope-secreX")).toBe(false);
	});

	it("returns false when lengths differ", () => {
		expect(secureEquals("short", "much-longer-value")).toBe(false);
	});
});
