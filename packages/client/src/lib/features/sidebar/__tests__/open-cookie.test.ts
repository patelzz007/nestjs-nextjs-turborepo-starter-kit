import { describe, expect, it } from "vitest";

import { parseSidebarOpenCookie, readSidebarOpenCookie, sidebarOpenCookieName, type ReadableCookies } from "../open-cookie";

function cookiesOf(entries: Readonly<Record<string, string>>): ReadableCookies {
	return {
		get: (name: string): { readonly value: string } | undefined => {
			const value = entries[name];
			return value === undefined ? undefined : { value };
		},
	};
}

describe("sidebar open cookie", () => {
	it("is named after the app's sidebar store, so apps never share one", () => {
		expect(sidebarOpenCookieName("admin-sidebar-state")).toBe("admin-sidebar-state-open");
	});

	it("reads back what was written", () => {
		expect(parseSidebarOpenCookie("true")).toBe(true);
		expect(parseSidebarOpenCookie("false")).toBe(false);
	});

	it("ignores a missing or foreign value (the app's default applies)", () => {
		expect(parseSidebarOpenCookie(undefined)).toBeUndefined();
		expect(parseSidebarOpenCookie("yes")).toBeUndefined();
		expect(parseSidebarOpenCookie("")).toBeUndefined();
	});

	it("reads an app's state from the server's cookies", () => {
		const cookies = cookiesOf({ "web-sidebar-open": "false" });

		expect(readSidebarOpenCookie(cookies, "web-sidebar")).toBe(false);
		expect(readSidebarOpenCookie(cookies, "admin-sidebar")).toBeUndefined();
	});
});
