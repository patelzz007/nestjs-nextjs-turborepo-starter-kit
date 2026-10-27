// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { APP_BRAND_TOKENS, findContrastViolations, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const PALETTE_CSS = readFileSync(require.resolve("@workspace/tokens/palette.css"), "utf8");
const BASE_CSS = readFileSync(require.resolve("@workspace/tokens/web.css"), "utf8");
const THEME_CSS = readFileSync(new URL("../web-theme.css", import.meta.url), "utf8");

const PALETTE = readCustomProperties(PALETTE_CSS, ":root");
const BASE_LIGHT = readCustomProperties(BASE_CSS, ":root", PALETTE);
const BASE_DARK = readCustomProperties(BASE_CSS, ".dark", BASE_LIGHT);
const BASE_NORD = readCustomProperties(BASE_CSS, ".nord", BASE_LIGHT);

/** The web theme's brand overrides layered on the shared tokens, as the cascade applies them. */
const LIGHT = readCustomProperties(THEME_CSS, ":root:not(.dark):not(.nord) .web-app", BASE_LIGHT);
const DARK = readCustomProperties(THEME_CSS, ".dark .web-app", BASE_DARK);
const NORD = readCustomProperties(THEME_CSS, ".nord .web-app", BASE_NORD);

/** Every custom property the stylesheet declares (`--name:`), as opposed to one it reads (`var(--name)`). */
const DECLARED_TOKENS = [...THEME_CSS.matchAll(/^\s*(?<token>--[\w-]+)\s*:/gmu)].map((match) => match.groups?.token ?? "");

describe("web theme", () => {
	it("re-maps brand and sidebar tokens only — page and card surfaces, borders and text stay shared", () => {
		expect(DECLARED_TOKENS.filter((token) => !APP_BRAND_TOKENS.includes(token))).toEqual([]);
	});

	it("meets every contrast minimum in the light theme (WCAG: 4.5:1 text, 3:1 focus rings, chart series, search highlight)", () => {
		expect(findContrastViolations(LIGHT)).toEqual([]);
	});

	it("meets every contrast minimum in the dark theme", () => {
		expect(findContrastViolations(DARK)).toEqual([]);
	});

	it("meets every contrast minimum in the Nord theme", () => {
		expect(findContrastViolations(NORD)).toEqual([]);
	});

	it("keeps its light overrides out of Nord (Nord is not `.dark`, so the light selector must exclude it)", () => {
		expect(THEME_CSS).not.toMatch(/:root:not\(\.dark\) \./u);
	});
});
