import { describe, expect, it } from "vitest";

import { getDefaultIconColor, getItemColor, getSectionBadgeColor, PALETTE_MARK_CLASS } from "./styles";

/** A Tailwind palette literal (`text-amber-600`, `dark:bg-indigo-900/40`) instead of a design token. */
const LITERAL_COLOR =
	/\b(?:text|bg|border|ring)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/u;

const TITLES: readonly string[] = ["Overview", "Billing", "Users", "Rewards", "Settings", "Analytics", "Geography", "Terminals"];

describe("command palette colours", () => {
	it("use design tokens only, so every theme and dark mode restyle them", () => {
		const classes = [...TITLES.map(getItemColor), getDefaultIconColor(), getSectionBadgeColor(), PALETTE_MARK_CLASS];

		for (const className of classes) {
			expect(className, className).not.toMatch(LITERAL_COLOR);
			expect(className, className).not.toMatch(/\bdark:/u);
		}
	});

	it("give a title the same tint every time", () => {
		expect(getItemColor("Billing")).toBe(getItemColor("Billing"));
	});

	it("highlight search matches with the shared search-mark tokens", () => {
		expect(PALETTE_MARK_CLASS).toContain("search-mark");
	});
});
