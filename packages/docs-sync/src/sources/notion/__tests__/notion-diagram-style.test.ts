import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parse } from "pele";
import { describe, expect, it } from "vitest";

import { STYLE_END, STYLE_START, withNotionStyle, withoutNotionStyle } from "../notion-diagram-style.ts";

const DOCS_ROOT = fileURLToPath(new URL("../../../../../../docs/", import.meta.url));
const MERMAID_FENCE = /^```mermaid\n(?<source>[\s\S]*?)^```$/gmu;

const CHART = [
	"flowchart TD",
	"    A[Install] --> B[Migrate]",
	"    B --> C{2FA set up?}",
	"    C -- no --> D[(Sessions)]",
	"    C -- yes --> E[Ready]",
	"    U((Merchant)) --> E",
].join("\n");

/** Every mermaid source in the published docs: the real charts the import colours. */
function docsCharts(): readonly string[] {
	return readdirSync(DOCS_ROOT, { recursive: true, encoding: "utf8" })
		.filter((file) => file.endsWith(".md") && !file.startsWith("history/"))
		.flatMap((file) => [...readFileSync(`${DOCS_ROOT}${file}`, "utf8").matchAll(MERMAID_FENCE)].map((match) => (match.groups?.source ?? "").replace(/\n$/u, "")));
}

describe("withNotionStyle", () => {
	it("colours each node by what it is for, after the chart, between markers", () => {
		const styled = withNotionStyle(CHART);
		expect(styled.startsWith(`${CHART}\n${STYLE_START}\n`)).toBe(true);
		expect(styled.endsWith(STYLE_END)).toBe(true);
		const lines = styled.split("\n");
		expect(lines.filter((line) => line.startsWith("class "))).toEqual([
			"class A entry",
			"class B step",
			"class D store",
			"class C decision",
			"class E outcome",
			"class U person",
		]);
		expect(lines.flatMap((line) => /^classDef (?<role>\S+) /u.exec(line)?.groups?.role ?? [])).toEqual(["entry", "step", "store", "decision", "outcome", "person"]);
		expect(lines).toContain("classDef decision fill:#fef0c7,stroke:#f79009,stroke-width:2px,color:#7a2e0e,rx:8px,ry:8px,font-family:sans-serif");
		expect(lines).toContain("linkStyle default stroke:#7d8797,stroke-width:1.5px");
	});

	it("asks for labels that cannot be cut off, in one font, with edge labels as solid, padded, spaced-out pills", () => {
		const directive = withNotionStyle(CHART)
			.split("\n")
			.flatMap((line) => /^%%\{init: (?<config>.*)\}%%$/u.exec(line)?.groups?.config ?? []);
		expect(directive).toHaveLength(1);
		const [config = ""] = directive;
		expect(JSON.parse(config)).toMatchObject({
			htmlLabels: false,
			flowchart: { htmlLabels: false, nodeSpacing: 70 },
			themeVariables: { fontFamily: "sans-serif", edgeLabelBackground: "#f2f4f7" },
		});
		expect(config).toContain('"themeCSS":".edgeLabel rect{opacity:1 !important');
		expect(config).toContain("drop-shadow(10px 0 0 #f2f4f7) drop-shadow(-10px 0 0 #f2f4f7)");
		// Mermaid sized each pill for its text as drawn; resizing the text would push it off centre.
		expect(config).not.toMatch(/font-size|font-weight/u);
		expect(config).not.toContain("}%%");
	});

	it("draws a yes edge green and a no edge red, by the first word of its label, and leaves other labels alone", () => {
		const chart = "flowchart TD\n  A{Ok?} -- No, repeatedly --> B\n  A -- yes, shows reward --> C\n  A -- Approved --> D\n  A -- network error --> E\n  A --> F";
		expect(
			withNotionStyle(chart)
				.split("\n")
				.filter((line) => /^linkStyle \d/u.test(line)),
		).toEqual(["linkStyle 0 stroke:#f04438,stroke-width:2px", "linkStyle 1 stroke:#17b26a,stroke-width:2px", "linkStyle 2 stroke:#17b26a,stroke-width:2px"]);
	});

	it("does not number edges in a chart that joins them with &, nor restyle an edge the author styled", () => {
		const numbered = (chart: string): readonly string[] =>
			withNotionStyle(chart)
				.split("\n")
				.filter((line) => /^linkStyle \d/u.test(line));
		expect(numbered("flowchart TD\n  A & B -- yes --> C")).toEqual([]);
		expect(numbered("flowchart TD\n  A -- yes --> B\n  linkStyle 0 stroke:#000")).toEqual([]);
	});

	it("defines only the roles the chart uses, and lists several nodes on one line", () => {
		const lines = withNotionStyle("flowchart LR\n  A --> B --> C --> D").split("\n");
		expect(lines.filter((line) => line.startsWith("class"))).toEqual([
			expect.stringMatching(/^classDef entry /u),
			expect.stringMatching(/^classDef step /u),
			expect.stringMatching(/^classDef outcome /u),
			"class A entry",
			"class B,C step",
			"class D outcome",
		]);
	});

	it("reads shapes written in Mermaid's newer syntax", () => {
		expect(withNotionStyle('flowchart TD\n  A --> B@{ shape: cyl, label: "Store" }\n  A --> C@{ shape: diam, label: "Ok?" }').split("\n")).toEqual(
			expect.arrayContaining(["class B store", "class C decision"]),
		);
	});

	it("leaves the author's own styling alone", () => {
		const chart = "flowchart TD\n  A --> B:::hot\n  A --> C\n  classDef hot fill:#f00\n  linkStyle default stroke:#000";
		const lines = withNotionStyle(chart).split("\n");
		expect(lines.filter((line) => line.startsWith("class "))).toEqual(["class A entry", "class C outcome"]);
		expect(lines.some((line) => line.startsWith("linkStyle default stroke:#7d8797"))).toBe(false);
	});

	it("returns what it cannot colour unchanged: other diagrams, a broken chart, a chart the author styled throughout", () => {
		for (const source of ["sequenceDiagram\n  A->>B: hi", "flowchart TD\n  A --> [", "flowchart TD\n  A:::x --> B:::x\n  classDef x fill:#f00"]) {
			expect(withNotionStyle(source)).toBe(source);
		}
	});

	it("replaces its own block when run again", () => {
		const once = withNotionStyle(CHART);
		expect(withNotionStyle(once)).toBe(once);
	});

	it("gives every chart in the docs a block the renderer still parses, and the sync gets the chart back byte for byte", () => {
		const charts = docsCharts();
		expect(charts.length).toBeGreaterThan(0);
		for (const chart of charts) {
			const styled = withNotionStyle(chart);
			expect(() => parse(styled)).not.toThrow();
			expect(withoutNotionStyle(styled)).toBe(chart);
		}
		expect(charts.filter((chart) => withNotionStyle(chart) !== chart).length).toBeGreaterThan(0);
	});
});

describe("withoutNotionStyle", () => {
	it("keeps what a writer added after the block", () => {
		expect(withoutNotionStyle(`flowchart TD\n  A --> B\n${STYLE_START}\nclass A entry\n${STYLE_END}\n  B --> C`)).toBe("flowchart TD\n  A --> B\n  B --> C");
	});

	it("leaves a source without a whole block unchanged", () => {
		for (const source of ["flowchart TD\n  A --> B", `flowchart TD\n${STYLE_START}\nclass A entry`, `flowchart TD\n${STYLE_END}\n${STYLE_START}`]) {
			expect(withoutNotionStyle(source)).toBe(source);
		}
	});
});
