import { describe, expect, it } from "vitest";

import { getUserInitials } from "./user-initials";

describe("getUserInitials", () => {
	it("returns two initials for a full name", () => {
		expect(getUserInitials("Alex Morgan")).toBe("AM");
	});

	it("returns two letters for a single-word name", () => {
		expect(getUserInitials("Cher")).toBe("CH");
	});

	it("returns a placeholder for an empty name", () => {
		expect(getUserInitials("")).toBe("?");
	});

	it("trims and collapses extra whitespace", () => {
		expect(getUserInitials("  alex   morgan  ")).toBe("AM");
	});
});
