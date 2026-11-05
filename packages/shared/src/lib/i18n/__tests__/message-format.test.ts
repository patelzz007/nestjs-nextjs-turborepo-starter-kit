import { describe, expect, it } from "vitest";

import { formatMessage } from "../message-format";

describe("formatMessage", () => {
	it("fills placeholders, numbers included", () => {
		expect(formatMessage("en", "Image {position} of {total}", { position: 2, total: 5 })).toBe("Image 2 of 5");
		expect(formatMessage("en", "No values here")).toBe("No values here");
	});

	it("pluralises by the language's own rules", () => {
		const items = "{count, plural, one {# item} other {# items}}";
		expect(formatMessage("en", items, { count: 1 })).toBe("1 item");
		expect(formatMessage("en", items, { count: 0 })).toBe("0 items");
		expect(formatMessage("en", items, { count: 7 })).toBe("7 items");
		// Chinese has one plural form: `other` serves every count.
		expect(formatMessage("zh-Hans", "{count, plural, other {# 项}}", { count: 1 })).toBe("1 项");
		expect(formatMessage("en", "{count, plural, =0 {none} one {one} other {#}}", { count: 0 })).toBe("none");
	});

	it("chooses with select, falling back to other", () => {
		const hint = "{dir, select, rtl {Left} other {Right}}";
		expect(formatMessage("en", hint, { dir: "rtl" })).toBe("Left");
		expect(formatMessage("en", hint, { dir: "ltr" })).toBe("Right");
	});

	it("keeps words in each language's order and its own script", () => {
		expect(formatMessage("ta", "{total} இல் {page} ஆம் பக்கம்", { page: 2, total: 9 })).toBe("9 இல் 2 ஆம் பக்கம்");
	});

	it("gives the same text from the cache as on first use", () => {
		const message = "Remove {label}";
		expect(formatMessage("ms", message, { label: "A" })).toBe("Remove A");
		expect(formatMessage("ms", message, { label: "B" })).toBe("Remove B");
	});

	it("refuses a message missing a value it needs", () => {
		expect(() => formatMessage("en", "Remove {label}")).toThrow(/label/u);
	});
});
