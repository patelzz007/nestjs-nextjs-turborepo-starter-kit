// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { clearAllLocationCookies, clearLocationCookie, locationCookieName, writeLocationCookie } from "@/contexts/tenancy/lib/tenant/location";
import { isSecureCookieOrigin, PREFERENCE_COOKIE_MAX_AGE_SECONDS, serializePreferenceCookie } from "@/contexts/tenancy/lib/tenant/preference-cookie";
import { clearTenantSlugCookie, TENANT_SLUG_COOKIE_NAME, writeTenantSlugCookie } from "@/contexts/tenancy/lib/tenant/slug";
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
	clearAllLocationCookies();
	clearTenantSlugCookie();
});

describe("tenant cookies", () => {
	it("keeps one store choice per tenant", () => {
		writeLocationCookie(ORG_ONE, STORE_A.id);
		writeLocationCookie(ORG_TWO, STORE_B.id);

		expect(cookieValue(locationCookieName(ORG_ONE))).toBe(STORE_A.id);
		expect(cookieValue(locationCookieName(ORG_TWO))).toBe(STORE_B.id);

		clearLocationCookie(ORG_ONE);
		expect(cookieValue(locationCookieName(ORG_ONE))).toBeUndefined();
		expect(cookieValue(locationCookieName(ORG_TWO))).toBe(STORE_B.id);
	});

	it("writes the last opened tenant, encoded", () => {
		writeTenantSlugCookie("acme coffee");

		expect(cookieValue(TENANT_SLUG_COOKIE_NAME)).toBe("acme%20coffee");
	});

	it("clears every preference on sign-out", () => {
		writeTenantSlugCookie(ORG_ONE);
		writeLocationCookie(ORG_ONE, STORE_A.id);
		writeLocationCookie(ORG_TWO, STORE_B.id);

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
		expect(serializePreferenceCookie("tenantSlug", "acme", { maxAgeSeconds: PREFERENCE_COOKIE_MAX_AGE_SECONDS, secure: true })).toBe(
			`tenantSlug=acme; path=/; max-age=${String(PREFERENCE_COOKIE_MAX_AGE_SECONDS)}; samesite=lax; secure`,
		);
		expect(serializePreferenceCookie("tenantSlug", "", { maxAgeSeconds: 0, secure: false })).toBe("tenantSlug=; path=/; max-age=0; samesite=lax");
	});
});
