import { describe, expect, it } from "vitest";

import { DOC_ICONS, docIcon, ICONS, iconSvg, SECTION_ICONS, sectionIcon } from "./icons";

describe("iconSvg", () => {
	it("renders a decorative, sized SVG with the icon's children", () => {
		const svg = iconSvg("search", 20, "text-brand");
		expect(svg).toMatch(/^<svg [^>]*width="20" height="20"/);
		expect(svg).toContain('aria-hidden="true"');
		expect(svg).toContain('class="text-brand"');
		expect(svg).toContain("<circle ");
	});

	it("omits the class attribute when none is given and escapes attribute values", () => {
		expect(iconSvg("x")).not.toContain("class=");
		expect(iconSvg("x", 16, 'a"b')).toContain('class="a&quot;b"');
	});

	it("renders the local GitHub mark as a filled path", () => {
		expect(iconSvg("github")).toContain('fill="currentColor"');
	});
});

describe("icon lookups", () => {
	it("uses mapped icons and falls back for unknown ids", () => {
		expect(docIcon("technical/database")).toBe("database");
		expect(docIcon("not-a-guide")).toBe("fileText");
		expect(sectionIcon("Decisions")).toBe("archive");
		expect(sectionIcon("Unknown")).toBe("layoutDashboard");
	});

	it("only maps to registered icons", () => {
		const registered = new Set(Object.keys(ICONS));
		for (const name of [...Object.values(DOC_ICONS), ...Object.values(SECTION_ICONS)]) {
			expect(registered.has(name)).toBe(true);
		}
	});
});
