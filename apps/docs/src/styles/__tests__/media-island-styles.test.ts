import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MEDIA_ISLAND_ROOT_ATTRIBUTE } from "@/lib/media/render";

/**
 * The media islands' images are rendered transparent at build time (the kit fades each one in once
 * React sees it load). The docs stylesheet shows them until the island is hydrated — from an
 * unlayered rule, since a rule inside a cascade layer loses to Tailwind's `opacity-0` utility.
 */
const CSS = readFileSync(new URL("../global.css", import.meta.url), "utf8");
const PRE_HYDRATION_RULE = `[${MEDIA_ISLAND_ROOT_ATTRIBUTE}]:not([data-hydrated="true"]) img {\n\topacity: 1;\n}`;

describe("media island styles", () => {
	it("shows an island's images until it is hydrated, outside every cascade layer", () => {
		const ruleAt = CSS.indexOf(PRE_HYDRATION_RULE);
		expect(ruleAt).toBeGreaterThan(-1);
		// Unlayered: after the last `@layer` block has closed, with nothing but the rule's comment between.
		expect(CSS.lastIndexOf("@layer")).toBeLessThan(ruleAt);
		expect(CSS.slice(ruleAt).trimEnd().endsWith("}")).toBe(true);
	});

	it("lets the components shape their own image corners", () => {
		expect(CSS).toContain(".prose .media-island img {\n\t\tborder-radius: 0;\n\t}");
	});
});
