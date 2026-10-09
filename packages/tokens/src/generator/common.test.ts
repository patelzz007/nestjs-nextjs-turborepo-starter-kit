import { describe, expect, it } from "vitest";

import { PALETTE } from "../palette";
import { colorToken, hex, oklch, paletteColor, rem, sizeToken, TRANSPARENT } from "../value";
import { formatWebColor, formatWebSize, GENERATE_COMMAND, generatedNotice, paletteDeclarations } from "./common";

describe("generatedNotice", () => {
	it("marks the file generated, names its source and the regenerate command, then states its purpose", () => {
		const notice = generatedNotice(["Purpose."]);

		expect(notice.at(0)).toBe("GENERATED FILE: do not edit by hand.");
		expect(notice.join("\n")).toContain(GENERATE_COMMAND);
		expect(notice.join("\n")).toContain("packages/tokens/src");
		expect(notice.at(-1)).toBe("Purpose.");
	});
});

describe("paletteDeclarations", () => {
	it("writes every palette step, scales in schema order and steps ascending", () => {
		const names = paletteDeclarations(PALETTE).map(({ name }) => name);

		expect(names.slice(0, 4)).toStrictEqual(["palette-neutral-0", "palette-neutral-25", "palette-neutral-40", "palette-neutral-50"]);
		expect(names.at(-1)).toBe("palette-green-975");
		expect(names).toHaveLength(Object.values(PALETTE).flatMap((steps) => Object.keys(steps)).length);
	});
});

describe("formatWebColor", () => {
	it("keeps references as var() and writes literals in full", () => {
		expect(formatWebColor(paletteColor("ink", "850"))).toBe("var(--palette-ink-850)");
		expect(formatWebColor(colorToken("tier-gold"))).toBe("var(--tier-gold)");
		expect(formatWebColor(oklch(0, 0, 0, 0.45))).toBe("oklch(0 0 0 / 0.45)");
		expect(formatWebColor(hex("#f1f4f9"))).toBe("#f1f4f9");
		expect(formatWebColor(TRANSPARENT)).toBe("transparent");
	});
});

describe("formatWebSize", () => {
	it("writes a length or a var() alias", () => {
		expect(formatWebSize(rem(104))).toBe("104rem");
		expect(formatWebSize(sizeToken("max-width-10xl"))).toBe("var(--max-width-10xl)");
	});
});
