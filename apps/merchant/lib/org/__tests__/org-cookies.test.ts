// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { clearAllOrganizationLocationCookies, clearOrganizationLocationCookie, organizationLocationCookieName, writeOrganizationLocationCookie } from "@/lib/org/location";
import { isSecureCookieOrigin, PREFERENCE_COOKIE_MAX_AGE_SECONDS, serializePreferenceCookie } from "@/lib/org/preference-cookie";
import { clearOrganizationSlugCookie, ORGANIZATION_SLUG_COOKIE_NAME, writeOrganizationSlugCookie } from "@/lib/org/slug";
import { clearMerchantPreferenceCookies } from "@/lib/session/use-merchant-logout";
import { STORE_A, STORE_B } from "@/test/terminals";

const ORG_ONE = "acme-coffee";
const ORG_TWO = "bean-there";

function cookieValue(name: string): string | undefined {
	const prefix = `${name}=`;
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
}

afterEach((): void => {
	clearAllOrganizationLocationCookies();
	clearOrganizationSlugCookie();
});

describe("organization cookies", () => {
	it("keeps one store choice per organization", () => {
		writeOrganizationLocationCookie(ORG_ONE, STORE_A.id);
		writeOrganizationLocationCookie(ORG_TWO, STORE_B.id);

		expect(cookieValue(organizationLocationCookieName(ORG_ONE))).toBe(STORE_A.id);
		expect(cookieValue(organizationLocationCookieName(ORG_TWO))).toBe(STORE_B.id);

		clearOrganizationLocationCookie(ORG_ONE);
		expect(cookieValue(organizationLocationCookieName(ORG_ONE))).toBeUndefined();
		expect(cookieValue(organizationLocationCookieName(ORG_TWO))).toBe(STORE_B.id);
	});

	it("writes the last opened organization, encoded", () => {
		writeOrganizationSlugCookie("acme coffee");

		expect(cookieValue(ORGANIZATION_SLUG_COOKIE_NAME)).toBe("acme%20coffee");
	});

	it("clears every preference on sign-out", () => {
		writeOrganizationSlugCookie(ORG_ONE);
		writeOrganizationLocationCookie(ORG_ONE, STORE_A.id);
		writeOrganizationLocationCookie(ORG_TWO, STORE_B.id);

		clearMerchantPreferenceCookies();

		expect(document.cookie).toBe("");
	});
});

describe("preference cookie attributes", () => {
	it("marks the cookie Secure on an https origin only", () => {
		expect(isSecureCookieOrigin("https://merchant.example.com")).toBe(true);
		expect(isSecureCookieOrigin("http://localhost:3003")).toBe(false);
	});

	it("serializes path, max-age, SameSite and — when required — Secure", () => {
		expect(serializePreferenceCookie("organizationSlug", "acme", { maxAgeSeconds: PREFERENCE_COOKIE_MAX_AGE_SECONDS, secure: true })).toBe(
			`organizationSlug=acme; path=/; max-age=${String(PREFERENCE_COOKIE_MAX_AGE_SECONDS)}; samesite=lax; secure`,
		);
		expect(serializePreferenceCookie("organizationSlug", "", { maxAgeSeconds: 0, secure: false })).toBe("organizationSlug=; path=/; max-age=0; samesite=lax");
	});
});
