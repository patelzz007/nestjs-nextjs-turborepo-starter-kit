// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { findContrastViolations, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";

const require = createRequire(import.meta.url);
/** The generated web tokens globals.css imports: palette + light theme in `:root`, dark theme in `.dark`, Nord in `.nord`. */
const TOKENS_CSS = readFileSync(require.resolve("@workspace/tokens/web.css"), "utf8");
/** The Expo app's tokens: one `@variant <theme>` block per theme, literal values, the app's own re-maps applied. Unindented so each block reads like a top-level rule. */
const MOBILE_CSS = readFileSync(require.resolve("@workspace/tokens/mobile.css"), "utf8").replace(/^\t+/gmu, "");
/** A mobile variant's declarations as the contrast check reads them (`--name` → value). */
function mobileTheme(theme: string): ReadonlyMap<string, string> {
	return readCustomProperties(MOBILE_CSS, `@variant ${theme}`);
}
const LIGHT = readCustomProperties(TOKENS_CSS, ":root");
const DARK = readCustomProperties(TOKENS_CSS, ".dark", LIGHT);
const NORD = readCustomProperties(TOKENS_CSS, ".nord", LIGHT);

describe("design token contrast (WCAG: 4.5:1 text, 3:1 focus rings, chart series, search highlight)", () => {
	it("the light theme meets every minimum", () => {
		expect(findContrastViolations(LIGHT)).toEqual([]);
	});

	it("the dark theme meets every minimum", () => {
		expect(findContrastViolations(DARK)).toEqual([]);
	});

	it("the Nord theme meets every minimum", () => {
		expect(findContrastViolations(NORD)).toEqual([]);
	});
});

describe("mobile design token contrast (the Expo app's mobile.css, its own re-maps applied)", () => {
	it.each(["light", "dark", "nord"])("the %s variant meets every minimum", (theme) => {
		expect(findContrastViolations(mobileTheme(theme))).toEqual([]);
	});
});
