// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { APP_BRAND_TOKENS, findContrastViolations, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const BASE_CSS = readFileSync(require.resolve("@workspace/ui/styles/tokens.css"), "utf8");
const THEME_CSS = readFileSync(new URL("./merchant-theme.css", import.meta.url), "utf8");

const BASE_LIGHT = readCustomProperties(BASE_CSS, ":root");
const BASE_DARK = readCustomProperties(BASE_CSS, ".dark", BASE_LIGHT);

/** The merchant theme's brand overrides layered on the shared tokens, as the cascade applies them. */
const LIGHT = readCustomProperties(THEME_CSS, ":root:not(.dark) .merchant-app", BASE_LIGHT);
const DARK = readCustomProperties(THEME_CSS, ".dark .merchant-app", BASE_DARK);

/** Every custom property the stylesheet declares (`--name:`), as opposed to one it reads (`var(--name)`). */
const DECLARED_TOKENS = [...THEME_CSS.matchAll(/^\s*(--[\w-]+)\s*:/gmu)].map((match) => match[1] ?? "");

describe("merchant theme", () => {
	it("re-maps brand tokens only — neutrals, surfaces and borders stay shared", () => {
		expect(DECLARED_TOKENS.filter((token) => !APP_BRAND_TOKENS.includes(token))).toEqual([]);
	});

	it("meets every contrast minimum in the light theme (WCAG: 4.5:1 text, 3:1 focus rings, chart series, search highlight)", () => {
		expect(findContrastViolations(LIGHT)).toEqual([]);
	});

	it("meets every contrast minimum in the dark theme", () => {
		expect(findContrastViolations(DARK)).toEqual([]);
	});
});
