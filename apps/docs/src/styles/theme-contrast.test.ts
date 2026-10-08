import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { contrastRatio, MIN_TEXT_CONTRAST, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const PALETTE_CSS = readFileSync(require.resolve("@workspace/ui/styles/palette.css"), "utf8");
const THEME_CSS = readFileSync(new URL("./global.css", import.meta.url), "utf8");

const PALETTE = readCustomProperties(PALETTE_CSS, ":root");
const LIGHT = readCustomProperties(THEME_CSS, ":root", PALETTE);
const DARK = readCustomProperties(THEME_CSS, '[data-theme="dark"]', LIGHT);

/** Every text colour the docs set, on every surface it is set on. */
const TEXT_PAIRINGS: readonly (readonly [string, string])[] = [
	["--text", "--bg"],
	["--text", "--surface-muted"],
	["--text-secondary", "--bg"],
	["--muted", "--bg"],
	["--muted", "--surface-muted"],
	["--brand-text", "--bg"],
	["--brand-text", "--brand-soft"],
	["--brand-text", "--nav-active-bg"],
	["--brand-text-hover", "--bg"],
	["--on-brand-solid", "--brand-solid"],
	["--on-brand-solid", "--brand-solid-hover"],
];

function violations(theme: ReadonlyMap<string, string>): readonly string[] {
	return TEXT_PAIRINGS.flatMap(([foreground, background]): string[] => {
		const ratio = contrastRatio(theme.get(foreground) ?? "", theme.get(background) ?? "");
		return ratio >= MIN_TEXT_CONTRAST ? [] : [`${foreground} on ${background}: ${ratio.toFixed(2)}:1`];
	});
}

describe("docs theme contrast (WCAG AA 4.5:1 text)", () => {
	it("meets the minimum for every text pair in the light theme", () => {
		expect(violations(LIGHT)).toEqual([]);
	});

	it("meets the minimum for every text pair in the dark theme", () => {
		expect(violations(DARK)).toEqual([]);
	});
});
