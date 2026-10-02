// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { clearOrganizationLocationCookie, ORGANIZATION_LOCATION_ID_COOKIE_NAME, writeOrganizationLocationCookie } from "@/lib/org/location";
import { ORGANIZATION_SLUG_COOKIE_NAME, writeOrganizationSlugCookie } from "@/lib/org/slug";
import { STORE_A } from "@/test/terminals";

function cookieValue(name: string): string | undefined {
	const prefix = `${name}=`;
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
}

afterEach((): void => {
	clearOrganizationLocationCookie();
	document.cookie = `${ORGANIZATION_SLUG_COOKIE_NAME}=; path=/; max-age=0`;
});

describe("organization cookies", () => {
	it("writes and clears the chosen store", () => {
		writeOrganizationLocationCookie(STORE_A.id);
		expect(cookieValue(ORGANIZATION_LOCATION_ID_COOKIE_NAME)).toBe(STORE_A.id);

		clearOrganizationLocationCookie();
		expect(cookieValue(ORGANIZATION_LOCATION_ID_COOKIE_NAME)).toBeUndefined();
	});

	it("writes the last opened organization, encoded", () => {
		writeOrganizationSlugCookie("acme coffee");

		expect(cookieValue(ORGANIZATION_SLUG_COOKIE_NAME)).toBe("acme%20coffee");
	});
});
