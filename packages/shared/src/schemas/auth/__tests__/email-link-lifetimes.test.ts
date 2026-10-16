import { describe, expect, it } from "vitest";

import { EMAIL_VERIFICATION_LINK_TTL_HOURS, formatLinkLifetimeHours, PASSWORD_RESET_LINK_TTL_HOURS } from "./email-link-lifetimes";

describe("formatLinkLifetimeHours", () => {
	it("uses the singular for one hour and the plural otherwise", () => {
		expect(formatLinkLifetimeHours(PASSWORD_RESET_LINK_TTL_HOURS)).toBe("1 hour");
		expect(formatLinkLifetimeHours(EMAIL_VERIFICATION_LINK_TTL_HOURS)).toBe("24 hours");
	});
});
