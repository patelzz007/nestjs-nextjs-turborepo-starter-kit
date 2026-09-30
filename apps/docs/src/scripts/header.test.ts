// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { initHeader, SCROLLED_CLASS } from "./header";

function setScroll(y: number): void {
	Object.defineProperty(window, "scrollY", { configurable: true, value: y });
}

function scrolled(): boolean {
	return document.querySelector(".site-header")?.classList.contains(SCROLLED_CLASS) ?? false;
}

describe("initHeader", () => {
	beforeEach(() => {
		document.body.innerHTML = `<header class="site-header"></header>`;
	});

	it("is transparent at the top and frosted once scrolled", async () => {
		setScroll(0);
		initHeader();
		expect(scrolled()).toBe(false);

		setScroll(120);
		window.dispatchEvent(new Event("scroll"));
		await new Promise((resolve) => window.requestAnimationFrame(resolve));
		expect(scrolled()).toBe(true);

		setScroll(0);
		window.dispatchEvent(new Event("scroll"));
		await new Promise((resolve) => window.requestAnimationFrame(resolve));
		expect(scrolled()).toBe(false);
	});

	it("starts frosted when the page loads mid-scroll", () => {
		setScroll(500);
		initHeader();
		expect(scrolled()).toBe(true);
	});

	it("does nothing without a header", () => {
		document.body.innerHTML = "";
		expect(() => {
			initHeader();
		}).not.toThrow();
	});
});
