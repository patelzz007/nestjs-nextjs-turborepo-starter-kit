// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocOutlineNav, headingAtReadingLine } from "../doc-outline-nav";
import type { DocHeading } from "../doc-outline";

const HEADINGS: readonly DocHeading[] = [
	{ id: "setup", text: "Setup", depth: 2 },
	{ id: "env", text: "The env file", depth: 3 },
	{ id: "next", text: "Next steps", depth: 2 },
];
const IDS = HEADINGS.map(({ id }) => id);

/** Places each heading at a viewport `top`, as if the page had scrolled. */
function placeHeadings(tops: Readonly<Record<string, number>>): void {
	for (const [id, top] of Object.entries(tops)) {
		const heading = document.getElementById(id);
		if (heading !== null) {
			heading.getBoundingClientRect = (): DOMRect => new DOMRect(0, top, 100, 20);
		}
	}
}

describe("headingAtReadingLine", () => {
	beforeEach(() => {
		for (const id of IDS) {
			const heading = document.createElement("h2");
			heading.id = id;
			document.body.append(heading);
		}
	});

	afterEach(() => {
		document.body.replaceChildren();
	});

	it("is the first heading before any has reached the line", () => {
		placeHeadings({ setup: 400, env: 900, next: 1400 });
		expect(headingAtReadingLine(IDS, 300)).toBe("setup");
	});

	it("is the last heading at or above the line — also after a jump past several", () => {
		placeHeadings({ setup: -900, env: -400, next: 120 });
		expect(headingAtReadingLine(IDS, 300)).toBe("next");
		placeHeadings({ setup: -900, env: 300, next: 800 });
		expect(headingAtReadingLine(IDS, 300)).toBe("env");
	});
});

describe("DocOutlineNav", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
			callback(0);
			return 1;
		});
		for (const id of IDS) {
			const heading = document.createElement("h2");
			heading.id = id;
			document.body.append(heading);
		}
		placeHeadings({ setup: 400, env: 900, next: 1400 });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.replaceChildren();
	});

	it("links every section, indenting subsections, and marks the first as current", () => {
		const { getByRole } = render(<DocOutlineNav headings={HEADINGS} label="On this page" />);

		const links = [...getByRole("navigation", { name: "On this page" }).querySelectorAll("a")];
		expect(links.map((link) => link.getAttribute("href"))).toStrictEqual(["#setup", "#env", "#next"]);
		expect(links.at(1)?.className).toContain("ps-6");
		expect(links.at(0)?.getAttribute("aria-current")).toBe("location");
	});

	it("follows the section scrolled to the reading line, in any scroll container", () => {
		const { getByRole } = render(<DocOutlineNav headings={HEADINGS} label="On this page" />);
		const scroller = document.createElement("main");
		document.body.append(scroller);

		placeHeadings({ setup: -900, env: -400, next: 50 });
		act(() => {
			fireEvent.scroll(scroller);
		});

		expect(getByRole("link", { name: "Next steps" }).getAttribute("aria-current")).toBe("location");
		expect(getByRole("link", { name: "Setup" }).hasAttribute("aria-current")).toBe(false);
	});

	it("renders nothing without sections", () => {
		const { container } = render(<DocOutlineNav headings={[]} label="On this page" />);
		expect(container.innerHTML).toBe("");
	});
});
