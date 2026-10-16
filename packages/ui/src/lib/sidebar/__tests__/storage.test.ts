// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { createCookieSidebarStorage } from "./storage";

function captureCookieWrites(): string[] {
	const writes: string[] = [];
	vi.spyOn(document, "cookie", "set").mockImplementation((value: string): void => {
		writes.push(value);
	});
	return writes;
}

afterEach((): void => {
	vi.restoreAllMocks();
});

describe("createCookieSidebarStorage", () => {
	it("writes a first-party cookie without Secure over http (local development)", () => {
		const writes = captureCookieWrites();

		createCookieSidebarStorage({ cookieName: "rail", maxAgeSeconds: 60 }).write(true);

		expect(writes).toEqual(["rail=true; path=/; max-age=60; SameSite=Lax"]);
	});

	it("marks the cookie Secure for an https page", () => {
		const writes = captureCookieWrites();

		createCookieSidebarStorage({ cookieName: "rail", maxAgeSeconds: 60, secure: true }).write(false);

		expect(writes).toEqual(["rail=false; path=/; max-age=60; SameSite=Lax; Secure"]);
	});

	it("reads back only true/false", () => {
		vi.spyOn(document, "cookie", "get").mockReturnValue("other=1; rail=false");

		expect(createCookieSidebarStorage({ cookieName: "rail" }).read()).toBe(false);
	});
});
