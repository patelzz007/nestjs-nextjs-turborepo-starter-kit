import { describe, expect, it } from "vitest";

import { COMPONENTS_NAV_STORAGE_KEY, readComponentsNavOpen } from "@/components/component-gallery/gallery-nav-cookie";

function cookiesWith(entries: Readonly<Record<string, string>>): { get: (name: string) => { readonly value: string } | undefined } {
	return {
		get: (name: string): { readonly value: string } | undefined => {
			const value = new Map(Object.entries(entries)).get(name);
			return value === undefined ? undefined : { value };
		},
	};
}

describe("readComponentsNavOpen", () => {
	it("reads the components navigation's own cookie", () => {
		expect(readComponentsNavOpen(cookiesWith({ [`${COMPONENTS_NAV_STORAGE_KEY}-open`]: "false" }))).toBe(false);
		expect(readComponentsNavOpen(cookiesWith({ [`${COMPONENTS_NAV_STORAGE_KEY}-open`]: "true" }))).toBe(true);
	});

	it("is open without a cookie, or with one it did not write", () => {
		expect(readComponentsNavOpen(cookiesWith({}))).toBe(true);
		expect(readComponentsNavOpen(cookiesWith({ [`${COMPONENTS_NAV_STORAGE_KEY}-open`]: "maybe" }))).toBe(true);
	});

	it("ignores the app sidebar's cookie: the two open and close independently", () => {
		expect(readComponentsNavOpen(cookiesWith({ "admin-sidebar-state-open": "false" }))).toBe(true);
	});
});
