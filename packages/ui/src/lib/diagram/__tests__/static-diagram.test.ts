// @vitest-environment node
import { createColorLookups, formatSrgbHex, resolveColorValue, TOKEN_SOURCE } from "@workspace/tokens";
import { PeleError } from "pele";
import { describe, expect, it } from "vitest";

import { renderStaticDiagram } from "@workspace/ui/lib/diagram/static-diagram";

const SOURCE = "flowchart LR\n  accTitle: Two steps\n  accDescr: A leads to B.\n  a[A] --> b[B]";

function cardColor(theme: "light" | "dark"): string {
	return formatSrgbHex(resolveColorValue({ kind: "token", name: "card" }, createColorLookups(TOKEN_SOURCE, theme)));
}

describe("renderStaticDiagram", () => {
	it("bakes the theme's literal token colours into the SVG", () => {
		const light = renderStaticDiagram(SOURCE, { theme: "light", idPrefix: "t" });
		const dark = renderStaticDiagram(SOURCE, { theme: "dark", idPrefix: "t" });

		expect(light).toContain(`--pele-bg:${cardColor("light")}`);
		expect(dark).toContain(`--pele-bg:${cardColor("dark")}`);
		expect(light).not.toContain("var(--card)");
	});

	it("puts the diagram on a padded card and keeps its accessible title and description", () => {
		const svg = renderStaticDiagram(SOURCE, { theme: "light", idPrefix: "steps" });

		expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+"/u);
		expect(svg).toContain('<rect x="0.5" y="0.5"');
		expect(svg).toContain('<g transform="translate(24 24)">');
		expect(svg).toContain('<title id="steps-title">Two steps</title>');
		expect(svg).toContain('<desc id="steps-desc">A leads to B.</desc>');
	});

	it("is deterministic", () => {
		expect(renderStaticDiagram(SOURCE, { theme: "dark", idPrefix: "t" })).toBe(renderStaticDiagram(SOURCE, { theme: "dark", idPrefix: "t" }));
	});

	it("throws Pele's error for a source that does not parse", () => {
		expect(() => renderStaticDiagram("flowchart LR\n  a --> ", { theme: "light", idPrefix: "t" })).toThrow(PeleError);
	});
});
