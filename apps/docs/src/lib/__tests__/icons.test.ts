import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DOC_ICONS, docIcon, GithubMark, iconComponent, ICONS, SECTION_ICONS, sectionIcon } from "../icons";

describe("icon registry", () => {
	it("should render a registered lucide icon as a sized SVG", () => {
		const svg = renderToStaticMarkup(createElement(iconComponent("search"), { size: 20, "aria-hidden": "true" }));
		expect(svg).toMatch(/^<svg [^>]*width="20" height="20"/);
		expect(svg).toContain("<circle ");
	});

	it("should render the local GitHub mark as a filled, decorative path at the default size", () => {
		const svg = renderToStaticMarkup(createElement(GithubMark));
		expect(svg).toContain('fill="currentColor"');
		expect(svg).toContain('aria-hidden="true"');
		expect(svg).toContain('width="16"');
	});
});

describe("icon lookups", () => {
	it("should use mapped icons and fall back for unknown ids", () => {
		expect(docIcon("technical/database")).toBe("database");
		expect(docIcon("not-a-guide")).toBe("fileText");
		expect(sectionIcon("Decisions")).toBe("archive");
		expect(sectionIcon("Unknown")).toBe("layoutDashboard");
	});

	it("should only map to registered icons", () => {
		const registered = new Set(Object.keys(ICONS));
		for (const name of [...Object.values(DOC_ICONS), ...Object.values(SECTION_ICONS)]) {
			expect(registered.has(name)).toBe(true);
		}
	});
});
