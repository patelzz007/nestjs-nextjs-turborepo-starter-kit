// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { findContrastViolations, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const BASE_CSS = readFileSync(require.resolve("@workspace/ui/styles/tokens.css"), "utf8");
const THEME_CSS = readFileSync(new URL("./web-theme.css", import.meta.url), "utf8");

const BASE_LIGHT = readCustomProperties(BASE_CSS, ":root");
const BASE_DARK = readCustomProperties(BASE_CSS, ".dark", BASE_LIGHT);

/** The web theme's brand overrides layered on the shared tokens, as the cascade applies them. */
const LIGHT = readCustomProperties(THEME_CSS, ":root:not(.dark) .web-app", BASE_LIGHT);
const DARK = readCustomProperties(THEME_CSS, ".dark .web-app", BASE_DARK);

describe("web theme contrast (WCAG: 4.5:1 text, 3:1 focus rings, chart series, search highlight)", () => {
	it("the light theme meets every minimum", () => {
		expect(findContrastViolations(LIGHT)).toEqual([]);
	});

	it("the dark theme meets every minimum", () => {
		expect(findContrastViolations(DARK)).toEqual([]);
	});
});
