import { describe, expect, it } from "vitest";

import { maskEmailAddress, maskPhone } from "../mask-contact";

describe("contact masking", () => {
	it("keeps the first letter and the domain of an email", () => {
		expect(maskEmailAddress("jane.doe@example.com")).toBe("j•••@example.com");
	});

	it("hides an address with no local part entirely", () => {
		expect(maskEmailAddress("@example.com")).toBe("••••");
		expect(maskEmailAddress("not-an-email")).toBe("••••");
	});

	it("keeps the country code and the last four digits of a phone number", () => {
		expect(maskPhone("+60123456789")).toBe("+60••••6789");
	});
});
