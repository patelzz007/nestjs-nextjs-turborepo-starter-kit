// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initToc } from "./toc";

function placeHeading(id: string, top: number): void {
	const heading = document.getElementById(id);
	if (heading === null) {
		throw new Error(`Missing heading ${id}`);
	}
	vi.spyOn(heading, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: top, width: 100, height: 20 }));
}

function activeLinks(): readonly string[] {
	return [...document.querySelectorAll<HTMLAnchorElement>(".is-active")].map((link) => link.dataset.tocLink ?? "");
}

describe("initToc", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<a data-toc-link="one" href="#one">One</a>
			<a data-toc-link="two" href="#two">Two</a>
			<a data-toc-link="missing" href="#missing">Missing</a>
			<button data-scroll-top></button>
			<h2 id="one">One</h2>
			<h2 id="two">Two</h2>`;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("marks the first heading at the top of the page", () => {
		placeHeading("one", 300);
		placeHeading("two", 900);
		initToc();
		expect(activeLinks()).toEqual(["one"]);
		expect(document.querySelector('[data-toc-link="one"]')?.getAttribute("aria-current")).toBe("location");
	});

	it("moves to the last heading scrolled past the header", async () => {
		placeHeading("one", -400);
		placeHeading("two", 50);
		initToc();
		expect(activeLinks()).toEqual(["two"]);

		placeHeading("two", 600);
		window.dispatchEvent(new Event("scroll"));
		await new Promise((resolve) => window.requestAnimationFrame(resolve));
		expect(activeLinks()).toEqual(["one"]);
		expect(document.querySelector('[data-toc-link="two"]')?.hasAttribute("aria-current")).toBe(false);
	});

	it("scrolls back to the top", () => {
		const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		initToc();
		document.querySelector<HTMLButtonElement>("[data-scroll-top]")?.click();
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});

	it("does nothing without headings", () => {
		document.body.innerHTML = "";
		expect(() => {
			initToc();
		}).not.toThrow();
	});
});
