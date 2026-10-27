// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DARK_THEME_NAMES } from "@workspace/tokens";
import { describe, expect, it } from "vitest";

const GLOBALS = readFileSync(join(import.meta.dirname, "..", "globals.css"), "utf8");
const COMPONENTS = readFileSync(join(import.meta.dirname, "..", "components.css"), "utf8");

describe("theme variants in globals.css", () => {
	it("applies every `dark:` utility under each dark theme class (.dark and .nord)", () => {
		const selectors = DARK_THEME_NAMES.map((name) => `.${name} *`).join(", ");
		expect(GLOBALS).toContain(`@custom-variant dark (&:is(${selectors}));`);
	});

	it("gives the browser's own surfaces a dark color-scheme under each dark theme, light otherwise", () => {
		expect(GLOBALS).toMatch(/:root \{\s*color-scheme: light;\s*\}/u);
		expect(GLOBALS).toContain(`${DARK_THEME_NAMES.map((name) => `.${name}`).join(",\n")} {\n\tcolor-scheme: dark;\n}`);
	});

	it("gives the primary button its coloured glow under Nord only", () => {
		expect(COMPONENTS).toMatch(/:root \{\s*--primary-glow-mix: 0%;\s*\}/u);
		expect(COMPONENTS).toMatch(/\.nord \{\s*--primary-glow-mix: 70%;\s*\}/u);
	});
});
