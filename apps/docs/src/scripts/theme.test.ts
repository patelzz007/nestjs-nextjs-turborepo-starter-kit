// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme, currentTheme, initTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from "./theme";

/** jsdom has no matchMedia; a minimal EventTarget-backed stand-in lets tests emit OS theme changes. */
function installMatchMedia(): EventTarget {
	const media = Object.assign(new EventTarget(), { matches: false, media: "(prefers-color-scheme: dark)" });
	Object.defineProperty(window, "matchMedia", { configurable: true, value: () => media });
	return media;
}

describe("theme", () => {
	let media: EventTarget;

	beforeEach(() => {
		media = installMatchMedia();
		document.body.innerHTML = `<button data-theme-toggle></button>`;
		document.documentElement.dataset.theme = "light";
		window.localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("toggles, persists and announces the theme", () => {
		const listener = vi.fn();
		document.addEventListener(THEME_CHANGE_EVENT, listener);
		initTheme();
		document.querySelector("button")?.click();
		expect(currentTheme()).toBe("dark");
		expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
		expect(listener).toHaveBeenCalledTimes(1);
		document.querySelector("button")?.click();
		expect(currentTheme()).toBe("light");
		document.removeEventListener(THEME_CHANGE_EVENT, listener);
	});

	it("follows the OS setting until the reader chooses", () => {
		initTheme();
		media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
		expect(currentTheme()).toBe("dark");

		window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
		media.dispatchEvent(Object.assign(new Event("change"), { matches: false }));
		expect(currentTheme()).toBe("dark");
	});

	it("still toggles when storage is unavailable", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		initTheme();
		document.querySelector("button")?.click();
		expect(currentTheme()).toBe("dark");
	});

	it("applyTheme writes the attribute read by the CSS", () => {
		applyTheme("dark");
		expect(document.documentElement.dataset.theme).toBe("dark");
	});
});
