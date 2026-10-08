// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const THEME_CSS = readFileSync(new URL("../../app/admin-theme.css", import.meta.url), "utf8");

/** Every custom property the stylesheet declares (`--name:`), as opposed to one it reads (`var(--name)`). */
const DECLARED_TOKENS = [...THEME_CSS.matchAll(/^\s*(?<token>--[\w-]+)\s*:/gmu)].map((match) => match.groups?.token);

describe("admin theme", () => {
	it("declares no tokens of its own — every colour comes from the shared palette, whose contrast tokens-contrast.test.ts proves", () => {
		expect(DECLARED_TOKENS).toEqual([]);
	});
});
