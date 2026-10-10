// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/** Each icon this app serves, and the packages/tokens file it must be a copy of — blue, like its sign-in tile (ADR 040). */
const ICONS: readonly (readonly [string, string])[] = [
	["icon.svg", "favicon-blue.svg"],
	["favicon.ico", "favicon-blue.ico"],
	["apple-icon.png", "apple-touch-icon-blue.png"],
];

describe("the web app's icons", () => {
	it.each(ICONS)("%s is the generated %s — run `pnpm tokens:generate`, which writes it", (committedPath, generatedName) => {
		const generated = readFileSync(require.resolve(`@workspace/tokens/icons/${generatedName}`));
		const committed = readFileSync(new URL(`./${committedPath}`, import.meta.url));

		expect(committed.equals(generated)).toBe(true);
	});
});
