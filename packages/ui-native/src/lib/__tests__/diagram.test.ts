import { render } from "pele";

import { DEFAULT_DIAGRAM_LABELS, DIAGRAM_THEME_VARIABLES, diagramSummary, resolveDiagramSvg } from "../diagram";

const THEME: Readonly<Record<string, string>> = { "--pele-bg": "#ffffff", "--pele-fg": "#111111", "--pele-line": "#444444", "--pele-radius": "6" };

describe("the native Diagram's theme", () => {
	it("reads every Pele colour from its token's stylesheet variable", () => {
		expect(DIAGRAM_THEME_VARIABLES).toContainEqual(["--pele-bg", "--color-card"]);
		expect(DIAGRAM_THEME_VARIABLES.every(([, css]) => css.startsWith("--color-"))).toBe(true);
		expect(DEFAULT_DIAGRAM_LABELS.loading).toBe("Loading diagram…");
	});

	it("resolves the theme's values, the root's own properties and fallbacks, and drops the root style", () => {
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" style="max-width:100%;--_fg:var(--pele-fg,#1f1f1f);--_m:var(--pele-muted,#6e6e6e);--_r:var(--pele-radius,4px)" fill="var(--_fg)"><rect rx="var(--_r)" fill="var(--_m)" stroke="var(--unknown)"/><path fill="var(--missing, rgb(1, 2, 3))"/></svg>';
		expect(resolveDiagramSvg(svg, THEME)).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" fill="#111111"><rect rx="6" fill="#6e6e6e" stroke=""/><path fill="rgb(1, 2, 3)"/></svg>',
		);
	});

	it("leaves an SVG without a root style alone, and stops a variable that refers to itself", () => {
		expect(resolveDiagramSvg('<svg><g fill="red"/></svg>', THEME)).toBe('<svg><g fill="red"/></svg>');
		expect(resolveDiagramSvg('<svg style="--_a:var(--_a)"><g fill="var(--_a)"/></svg>', {})).toBe('<svg><g fill=""/></svg>');
	});

	it("turns a real Pele drawing into one with no CSS variables left", () => {
		const { svg } = render("flowchart LR\n accTitle: Release\n accDescr: Review &amp; merge\n a[PR] --> b[Merge]", { responsive: false });
		const resolved = resolveDiagramSvg(svg, THEME);
		expect(resolved).not.toContain("var(");
		expect(diagramSummary(resolved)).toEqual({ title: "Release", description: "Review &amp; merge".replace("&amp;", "&") });
	});

	it("names a diagram without accTitle or accDescr with nothing", () => {
		expect(diagramSummary("<svg><g/></svg>")).toEqual({ title: "", description: "" });
		expect(diagramSummary("<svg><title>A &lt;b&gt; &quot;c&quot; &#39;d&#39; &apos;e&apos; &copy;</title></svg>").title).toBe("A <b> \"c\" 'd' 'e' &copy;");
	});
});
