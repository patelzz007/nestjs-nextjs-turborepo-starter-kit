import { describe, expect, it } from "vitest";

import { getInitials } from "@/lib/user-initials";

describe("getInitials", () => {
	it("derives two initials from a full name", () => {
		expect(getInitials("Alex Morgan")).toBe("AM");
	});

	it("handles single-word names", () => {
		expect(getInitials("Cher")).toBe("C");
	});

	it("handles empty input", () => {
		expect(getInitials("")).toBe("");
	});

	it("normalises extra whitespace", () => {
		expect(getInitials("  alex   morgan  ")).toBe("AM");
	});
});
