import { describe, expect, it } from "vitest";

import { lightPinnedHtml, stripDarkMediaBlocks } from "../email-preview";

const DARK = "@media (prefers-color-scheme: dark) { .a { color: #fff; } .b { background: #000; } }";

describe("stripDarkMediaBlocks", () => {
	it("removes every dark-mode block, nested braces included, and keeps the rest", () => {
		expect(stripDarkMediaBlocks(`<style>.x{color:red}${DARK}.y{margin:0}${DARK}</style>`)).toBe("<style>.x{color:red}.y{margin:0}</style>");
	});

	it("leaves HTML without a dark-mode block unchanged", () => {
		expect(stripDarkMediaBlocks("<p>hi</p>")).toBe("<p>hi</p>");
	});

	it("keeps an unterminated block rather than looping forever", () => {
		expect(stripDarkMediaBlocks("@media (prefers-color-scheme: dark) { .a {")).toBe("@media (prefers-color-scheme: dark) { .a {");
	});
});

describe("lightPinnedHtml", () => {
	it("drops the dark-mode CSS and the colour-scheme metas", () => {
		const html = `<head><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>${DARK}</style></head>`;

		expect(lightPinnedHtml(html)).toBe("<head><style></style></head>");
	});
});
