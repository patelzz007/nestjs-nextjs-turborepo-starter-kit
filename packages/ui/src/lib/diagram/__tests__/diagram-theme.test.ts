import { resolveColorToken, THEME_NAMES, TOKEN_SOURCE } from "@workspace/tokens";
import { describe, expect, it } from "vitest";

import { DIAGRAM_COLOR_TOKENS, diagramThemeStyle } from "@workspace/ui/lib/diagram/diagram-theme";

describe("DIAGRAM_COLOR_TOKENS", () => {
	it.each(THEME_NAMES)("maps every Pele colour to a token that resolves in the %s theme", (theme) => {
		for (const token of Object.values(DIAGRAM_COLOR_TOKENS)) {
			expect(resolveColorToken(TOKEN_SOURCE, theme, token)).not.toBe("");
		}
	});

	it("covers the variables a diagram draws with: text, lines, fills, borders and the chart series", () => {
		const variables = Object.keys(DIAGRAM_COLOR_TOKENS);

		expect(variables).toStrictEqual(
			expect.arrayContaining(["--pele-bg", "--pele-fg", "--pele-muted", "--pele-line", "--pele-surface", "--pele-surface-alt", "--pele-border", "--pele-accent"]),
		);
		expect(variables.filter((variable) => variable.startsWith("--pele-series-"))).toHaveLength(8);
	});
});

describe("diagramThemeStyle", () => {
	it("references the tokens as CSS variables, so a theme switch needs no re-render", () => {
		const style = diagramThemeStyle();

		expect(style["--pele-bg"]).toBe("var(--card)");
		expect(style["--pele-accent"]).toBe("var(--primary)");
		expect(style["--pele-radius"]).toBe("var(--radius-md)");
		expect(style["--pele-font"]).toBe("var(--font-sans)");
	});
});
