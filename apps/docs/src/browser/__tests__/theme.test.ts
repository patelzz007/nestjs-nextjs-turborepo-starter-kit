// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CODE_THEME_STORAGE_KEY } from "../code-theme";
import { applyTheme, currentTheme, cycleTheme, followSystemTheme, storedTheme, THEME_BOOTSTRAP_SCRIPT, THEME_CHANGE_EVENT, THEME_STORAGE_KEY, toTheme } from "../theme";

/** jsdom has no matchMedia; a minimal EventTarget-backed stand-in lets tests emit OS theme changes. */
function installMatchMedia(matches = false): EventTarget {
	const media = Object.assign(new EventTarget(), { matches, media: "(prefers-color-scheme: dark)" });
	Object.defineProperty(window, "matchMedia", { configurable: true, value: () => media });
	return media;
}

function resetRoot(): void {
	document.documentElement.className = "";
	delete document.documentElement.dataset.codeTheme;
	delete document.documentElement.dataset.js;
}

describe("theme", () => {
	let media: EventTarget;
	const button = document.createElement("button");

	beforeEach(() => {
		media = installMatchMedia();
		resetRoot();
		window.localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should switch light → dark → light, persisting and announcing each theme", () => {
		const listener = vi.fn();
		document.addEventListener(THEME_CHANGE_EVENT, listener);
		expect(cycleTheme(button)).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
		expect(listener).toHaveBeenCalledTimes(1);
		expect(cycleTheme(button)).toBe("light");
		expect(document.documentElement.className).toBe("");
		document.removeEventListener(THEME_CHANGE_EVENT, listener);
	});

	it("should read the theme from the class on <html> and only accept known theme names", () => {
		applyTheme("dark");
		expect(currentTheme()).toBe("dark");
		expect(toTheme("sepia")).toBeNull();
		// The apps' Nord is not a docs theme: a choice stored by an older version falls back to the OS.
		expect(toTheme("nord")).toBeNull();
		expect(toTheme("dark")).toBe("dark");
	});

	it("should follow the OS setting until the reader chooses, and stop when unsubscribed", () => {
		const stop = followSystemTheme();
		media.dispatchEvent(Object.assign(new Event("change"), { matches: true }));
		expect(currentTheme()).toBe("dark");

		window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
		media.dispatchEvent(Object.assign(new Event("change"), { matches: false }));
		expect(currentTheme()).toBe("dark");

		window.localStorage.clear();
		stop();
		media.dispatchEvent(Object.assign(new Event("change"), { matches: false }));
		expect(currentTheme()).toBe("dark");
	});

	it("should still cycle when storage is unavailable", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(cycleTheme(button)).toBe("dark");
		expect(storedTheme()).toBeNull();
	});
});

describe("THEME_BOOTSTRAP_SCRIPT", () => {
	beforeEach(() => {
		resetRoot();
		window.localStorage.clear();
	});

	function runInPage(source: string): void {
		const script = document.createElement("script");
		script.textContent = source;
		document.head.append(script);
		script.remove();
	}

	/**
	 * Runs the script the way the page does: an inline `<script>` in the document. jsdom runs inline scripts in
	 * its own window, which the test's globals do not reach, so the OS setting is stubbed by a script too.
	 */
	function runBootstrap(prefersDark: boolean): void {
		runInPage(`window.matchMedia = function () { return { matches: ${String(prefersDark)} }; };`);
		runInPage(THEME_BOOTSTRAP_SCRIPT);
	}

	it("should apply the stored theme and code theme before paint and mark scripts as running", () => {
		window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
		window.localStorage.setItem(CODE_THEME_STORAGE_KEY, "dark");
		runBootstrap(false);
		expect(document.documentElement.className).toBe("dark");
		expect(document.documentElement.dataset.codeTheme).toBe("dark");
		expect(document.documentElement.dataset.js).toBe("true");
	});

	it("should ignore a stored theme the docs no longer offer and follow the OS instead", () => {
		window.localStorage.setItem(THEME_STORAGE_KEY, "nord");
		runBootstrap(true);
		expect(document.documentElement.className).toBe("dark");
	});

	it("should fall back to the OS setting, and ignore unknown stored values", () => {
		window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
		window.localStorage.setItem(CODE_THEME_STORAGE_KEY, "sepia");
		runBootstrap(true);
		expect(document.documentElement.className).toBe("dark");
		expect(document.documentElement.dataset.codeTheme).toBeUndefined();
	});

	it("should leave light as no class", () => {
		runBootstrap(false);
		expect(document.documentElement.className).toBe("");
	});
});
