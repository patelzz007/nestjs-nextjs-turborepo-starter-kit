// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { findContrastViolations, readCustomProperties } from "@workspace/ui/lib/core/color-contrast";

const require = createRequire(import.meta.url);
/** The generated web tokens globals.css imports: palette + light theme in `:root`, dark theme in `.dark`. */
const TOKENS_CSS = readFileSync(require.resolve("@workspace/tokens/web.css"), "utf8");
const LIGHT = readCustomProperties(TOKENS_CSS, ":root");
const DARK = readCustomProperties(TOKENS_CSS, ".dark", LIGHT);

describe("design token contrast (WCAG: 4.5:1 text, 3:1 focus rings, chart series, search highlight)", () => {
	it("the light theme meets every minimum", () => {
		expect(findContrastViolations(LIGHT)).toEqual([]);
	});

	it("the dark theme meets every minimum", () => {
		expect(findContrastViolations(DARK)).toEqual([]);
	});
});
