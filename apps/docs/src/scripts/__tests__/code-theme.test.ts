// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyCodeTheme, CODE_THEME_STORAGE_KEY, currentCodeTheme, initCodeTheme, nextCodeTheme } from "../code-theme";

describe("code theme", () => {
	beforeEach(() => {
		document.body.innerHTML = '<div class="code-block-island"><button type="button" class="code-theme-toggle"><span>Auto</span></button></div>';
	});

	afterEach(() => {
		applyCodeTheme("site");
		window.localStorage.clear();
	});

	it("cycles match the site → light → dark → match the site", () => {
		expect(nextCodeTheme("site")).toBe("light");
		expect(nextCodeTheme("light")).toBe("dark");
		expect(nextCodeTheme("dark")).toBe("site");
	});

	it("matches the site while <html> names no code theme", () => {
		expect(currentCodeTheme()).toBe("site");
		applyCodeTheme("dark");
		expect(document.documentElement.dataset.codeTheme).toBe("dark");
		applyCodeTheme("site");
		expect(document.documentElement.dataset.codeTheme).toBeUndefined();
	});

	it("switches every code block on a toggle click (even on the icon inside it) and remembers the choice", () => {
		initCodeTheme();
		const label = document.querySelector(".code-theme-toggle span");
		label?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(currentCodeTheme()).toBe("light");
		expect(window.localStorage.getItem(CODE_THEME_STORAGE_KEY)).toBe("light");

		document.querySelector(".code-theme-toggle")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(currentCodeTheme()).toBe("dark");

		// Back to "match the site": nothing stored, so the site's theme decides again.
		document.querySelector(".code-theme-toggle")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(currentCodeTheme()).toBe("site");
		expect(window.localStorage.getItem(CODE_THEME_STORAGE_KEY)).toBeNull();
	});

	it("ignores clicks elsewhere", () => {
		initCodeTheme();
		document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(currentCodeTheme()).toBe("site");
	});
});
