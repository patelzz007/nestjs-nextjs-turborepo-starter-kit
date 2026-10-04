import { describe, expect, it } from "vitest";

import { formatCount } from "./number";

describe("formatCount", () => {
	it("groups digits the way the given locale does", () => {
		expect(formatCount(1_234_567, "en-MY")).toBe("1,234,567");
		expect(formatCount(1_234_567, "de-DE")).toBe("1.234.567");
		expect(formatCount(0, "en-MY")).toBe("0");
	});
});
