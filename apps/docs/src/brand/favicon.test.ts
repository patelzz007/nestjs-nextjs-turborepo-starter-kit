// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/** Each icon this app serves, and the packages/tokens file it must be a copy of — slate, the shared default (ADR 040). */
const ICONS: readonly (readonly [string, string])[] = [
	["favicon.svg", "favicon.svg"],
	["favicon.ico", "favicon.ico"],
	["apple-touch-icon.png", "apple-touch-icon.png"],
];

describe("the docs site's icons", () => {
	it.each(ICONS)("%s is the generated %s — run `pnpm tokens:generate`, which writes it", (committedPath, generatedName) => {
		const generated = readFileSync(require.resolve(`@workspace/tokens/icons/${generatedName}`));
		const committed = readFileSync(new URL(`../../public/${committedPath}`, import.meta.url));

		expect(committed.equals(generated)).toBe(true);
	});
});
