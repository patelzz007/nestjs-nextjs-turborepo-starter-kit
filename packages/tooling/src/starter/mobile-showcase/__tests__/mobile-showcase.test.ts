import { existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { settings } from "../../../shared/settings.ts";
import { catalogGaps, cvaDefaultsOf, clipType, fileOfModule, inheritedFrom, kitPathOf, orderEntries } from "../api.ts";
import { CODE_ROLES, encodeHighlighted, GITHUB_LIGHT_ROLES, loadHighlighter, highlightSource, rolePositionOf, TOKEN_SEPARATOR } from "../code.ts";
import { faqOf, fencedBlocksOf, listItemsOf, parseDocs, parseOverview, sectionsOf } from "../content.ts";
import { componentSlugs, constantCaseOf, examplesOf, parseGuidelines, parseManifest, pascalCaseOf, readComponent, uniqueAnchors } from "../features.ts";
import { checkShowcase, catalogGaps as appCatalogGaps, layoutOf, writeShowcase } from "../index.ts";
import type { ApiEntry, ShowcaseAppLayout, ShowcaseCatalogComponent, ShowcaseLayout } from "../layout.ts";

/** Rendering, colouring and formatting every module, and starting the TypeScript server for the API, takes a while. */
const GENERATOR_TIMEOUT_MS = 120_000;

/** The starter kit's mobile app: its examples and its kit, read from disk (the generator never imports the app). */
const APP_ROOT = path.resolve(import.meta.dirname, "../../../../../..", settings.folders.mobile ?? "");

/** A plain anchor: lowercase words joined by hyphens. */
const anchorOf = (label: string): string =>
	label
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "");

const LAYOUT: ShowcaseLayout = {
	appRoot: APP_ROOT,
	examplesDir: "src/features/showcase/examples",
	generatedDir: "src/features/showcase/generated",
	kitDir: "../../packages/ui-native/src",
	kitAlias: "@workspace/ui-native/",
	tsconfig: "../../packages/ui-native/tsconfig.json",
	anchorOf,
	fences: { api: "showcase-api", example: "showcase-example" },
};

const BUTTON: ShowcaseCatalogComponent = { slug: "button", name: "Button", modules: ["button", "icon-button", "text-link"] };

/**
 * Components whose API covers what the extractor reads: components with cva and destructured defaults, hooks, helper
 * functions, contexts and variants left out, a `lib/` module, and a name the screen is not named after.
 */
const CATALOG: readonly ShowcaseCatalogComponent[] = [
	BUTTON,
	{ slug: "code-block", name: "CodeBlock", modules: ["code-block"] },
	{ slug: "data-grid", name: "DataGrid", modules: ["data-grid", "data-grid-parts"] },
	{ slug: "file-upload", name: "useFileUpload", modules: ["lib/use-file-upload"] },
	{ slug: "message-scroller", name: "", modules: ["message-scroller"] },
];

const VALID_FEATURE = { id: "c-button-1", label: "Default", description: "The default button.", file: "button-1", export: "Button1Example" };
const SIDE = { text: "Say what it does.", file: "button-do-1", export: "ButtonDo1Example" };

describe("the features and guidelines manifests", () => {
	it("name modules and anchors predictably", () => {
		expect(pascalCaseOf("data-grid")).toBe("DataGrid");
		expect(constantCaseOf("data-grid")).toBe("DATA_GRID");
		expect(uniqueAnchors(["Basic", "Basic", "Sizes", "basic"], anchorOf)).toStrictEqual(["basic", "basic-2", "sizes", "basic-3"]);
	});

	it("refuse a malformed features manifest and name the file", () => {
		expect(() => parseManifest("button/features.json", JSON.stringify([]))).toThrow("button/features.json");
		expect(() => parseManifest("x", JSON.stringify([{ ...VALID_FEATURE, id: "button-1" }]))).toThrow();
		expect(() => parseManifest("x", JSON.stringify([{ ...VALID_FEATURE, label: "" }]))).toThrow();
		expect(() => parseManifest("x", JSON.stringify([{ ...VALID_FEATURE, export: "button1" }]))).toThrow();
		expect(parseManifest("x", JSON.stringify([VALID_FEATURE]))).toHaveLength(1);
	});

	it("require at least two Do / Don't pairs, each side with its text and its example", () => {
		const pair = { title: "Say what it does", do: SIDE, dont: { ...SIDE, file: "button-dont-1", export: "ButtonDont1Example" } };
		expect(() => parseGuidelines("button/guidelines.json", JSON.stringify([pair]))).toThrow("button/guidelines.json");
		expect(() => parseGuidelines("x", JSON.stringify([pair, { ...pair, dont: { ...pair.dont, text: "" } }]))).toThrow();
		expect(parseGuidelines("x", JSON.stringify([pair, pair]))).toHaveLength(2);
	});

	it("read a component's features and guidelines from its folder, each example once", () => {
		const button = readComponent(LAYOUT, "button");
		expect(button.features.at(0)).toMatchObject({ id: "c-button-1", anchor: "default", file: "button-1" });
		expect(button.guidelines.length).toBeGreaterThanOrEqual(2);
		const files = examplesOf(button).map((example) => example.file);
		expect(new Set(files).size).toBe(files.length);
		expect(files).toContain("button-do-1");
	});

	it("list the component folders, sorted, leaving out tests", () => {
		const slugs = componentSlugs(LAYOUT);
		expect(slugs).toContain("button");
		expect(slugs).not.toContain("__tests__");
		expect(slugs).toStrictEqual([...slugs].sort());
	});
});

describe("the written content", () => {
	const OVERVIEW = [
		"## When to use",
		"",
		"- For an action",
		"  that continues",
		"",
		"## When not to use",
		"",
		"- For a link",
		"",
		"## About",
		"",
		"Body.",
		"",
		"## Frequently asked questions",
		"",
		"### Why?",
		"",
		"Because.",
	].join("\n");

	it("splits the overview into its lists, its body and its FAQ", () => {
		const overview = parseOverview(OVERVIEW, "overview.md");
		expect(overview.whenToUse).toStrictEqual(["For an action that continues"]);
		expect(overview.notes).toStrictEqual([]);
		expect(overview.body).toBe("## About\n\nBody.");
		expect(overview.faq).toStrictEqual([{ question: "Why?", answer: "Because." }]);
	});

	it("refuses text before the first heading, a list with prose, and an unanswered question", () => {
		expect(() => sectionsOf("stray\n## A", "f.md")).toThrow(/before the first/u);
		expect(() => listItemsOf({ title: "When to use", lines: ["prose"] }, "f.md")).toThrow(/holds only/u);
		expect(() => faqOf({ title: "Frequently asked questions", lines: ["### Why?"] }, "f.md")).toThrow(/needs an answer/u);
	});

	it("reads a fenced heading as code, joins a continued item, and keeps the notes", () => {
		const sections = sectionsOf("## Code\n\n```md\n## not a heading\n```\n", "f.md");
		expect(sections.map((section) => section.title)).toStrictEqual(["Code"]);
		expect(listItemsOf({ title: "Notes", lines: ["- One", "  more", "", "- Two"] }, "f.md")).toStrictEqual(["One more", "Two"]);
		const overview = parseOverview(`## Notes\n\n- Mind the gap\n\n${OVERVIEW}`, "overview.md");
		expect(overview.notes).toStrictEqual(["Mind the gap"]);
	});

	it("names what an overview lacks: a required list, an item, an answer, a body", () => {
		expect(() => parseOverview("## About\n\nBody.", "o.md")).toThrow(/missing "## When to use"/u);
		expect(() => listItemsOf({ title: "When to use", lines: [""] }, "o.md")).toThrow(/is empty/u);
		expect(() => faqOf({ title: "Frequently asked questions", lines: ["", "### Why?", "", "### How?", "So."] }, "o.md")).toThrow(/"Why\?"/u);
		expect(() => faqOf({ title: "Frequently asked questions", lines: [] }, "o.md")).toThrow(/needs an answer$/u);
		expect(() => faqOf({ title: "Frequently asked questions", lines: ["prose"] }, "o.md")).toThrow(/must start with/u);
		const withoutBody = OVERVIEW.replace("## About\n\nBody.\n\n", "");
		expect(() => parseOverview(withoutBody, "o.md")).toThrow(/at least one overview section/u);
	});

	it("needs exactly one API block in the docs, and only examples the component has", () => {
		expect(fencedBlocksOf("```showcase-example\nc-a\n```", "showcase-example")).toStrictEqual(["c-a"]);
		expect(() => parseDocs("## Usage\n", "docs.md", [], LAYOUT.fences)).toThrow(/exactly one/u);
		expect(() => parseDocs("## API\n\n```showcase-api\n\n```\n\n```showcase-example\nc-missing\n```", "docs.md", [], LAYOUT.fences)).toThrow(/c-missing/u);
	});
});

describe("the code colouring", () => {
	it("names every GitHub light colour by a role the app knows", () => {
		for (const role of GITHUB_LIGHT_ROLES.values()) {
			expect(CODE_ROLES).toContain(role);
		}
		expect(rolePositionOf("#d73a49", "x")).toBe(CODE_ROLES.indexOf("keyword"));
		expect(() => rolePositionOf("#123456", "x.tsx")).toThrow(/x\.tsx/u);
	});

	it("colours a source and writes it compactly, refusing a source that holds the separator", async () => {
		const highlighter = await loadHighlighter();
		try {
			const lines = highlightSource(highlighter, "const a = 1;\n", "x.tsx");
			expect(lines).toHaveLength(1);
			expect(encodeHighlighted(lines, "x.tsx").split(TOKEN_SEPARATOR).at(0)).toBe(`${String(CODE_ROLES.indexOf("keyword"))}const`);
			expect(() => encodeHighlighted([[[0, `a${TOKEN_SEPARATOR}b`]]], "x.tsx")).toThrow(/separator/u);
		} finally {
			highlighter.dispose();
		}
	});
});

describe("the API reference helpers", () => {
	it("find a catalog module's kit file", () => {
		expect(kitPathOf("button")).toBe("components/button");
		expect(kitPathOf("lib/use-file-upload")).toBe("lib/use-file-upload");
		expect(fileOfModule(LAYOUT, "button")).toMatch(/components\/button\.tsx$/u);
		expect(fileOfModule(LAYOUT, "no-such-module")).toBeNull();
	});

	it("summarise inherited props, read cva defaults and clip long types", () => {
		expect(inheritedFrom("/node_modules/react-native/types/View.d.ts")).toBe("React Native props");
		expect(inheritedFrom("/node_modules/@types/react/index.d.ts")).toBe("React props");
		expect(inheritedFrom("/src/components/button.tsx")).toBeNull();
		expect(cvaDefaultsOf('cva("", { defaultVariants: { size: "md", tone: "a" } }); cva("", { defaultVariants: { size: "sm" } })')).toStrictEqual(new Map([["tone", '"a"']]));
		expect(clipType("x".repeat(300))).toHaveLength(240);
	});

	it("puts the component the screen is named after first, then components, hooks and helpers", () => {
		const entry = (name: string, kind: "component" | "hook" | "function"): ApiEntry => ({
			name,
			kind,
			module: "m",
			description: "",
			props: [],
			inherits: [],
			signature: null,
		});
		expect(
			orderEntries("Button", [entry("useX", "hook"), entry("helper", "function"), entry("IconButton", "component"), entry("Button", "component")]).map((e) => e.name),
		).toStrictEqual(["Button", "IconButton", "useX", "helper"]);
	});
});

describe("the catalog's coverage of the kit", () => {
	it("names every kit component it neither shows nor leaves out, and every module with no kit file", () => {
		const gaps = catalogGaps(LAYOUT, [{ ...BUTTON, modules: ["button", "no-such-module"] }], ["icon"]);
		expect(gaps).toContain('catalog module "no-such-module" has no kit file');
		expect(gaps).toContain('kit component "avatar" is in no catalog entry');
		expect(gaps.some((gap) => gap.includes('"button"') || gap.includes('"icon"'))).toBe(false);
		expect(gaps).toStrictEqual([...gaps].sort());
	});
});

describe("the generator", () => {
	it(
		"writes every module into the generated folder, then finds it current — and reports a module it would not write",
		async () => {
			const scratch = mkdtempSync(path.join(APP_ROOT, ".showcase-test-"));
			const { appRoot, ...rest } = LAYOUT;
			const layout: ShowcaseAppLayout = { ...rest, appUrl: pathToFileURL(`${appRoot}/`), generatedDir: path.relative(appRoot, scratch) };
			expect(layoutOf(layout).appRoot).toBe(path.join(appRoot, path.sep));
			expect(appCatalogGaps(layout, [BUTTON], [])).toContain('kit component "avatar" is in no catalog entry');
			try {
				const count = await writeShowcase(layout, CATALOG);
				expect(count).toBeGreaterThan(0);
				expect(existsSync(path.join(scratch, "components", "button.tsx"))).toBe(true);
				expect(existsSync(path.join(scratch, "api", "button.ts"))).toBe(true);
				expect(await checkShowcase(layout, CATALOG)).toStrictEqual([]);
				expect(await checkShowcase(layout, [BUTTON])).toStrictEqual([
					"api/code-block.ts",
					"api/data-grid.ts",
					"api/file-upload.ts",
					"api/index.ts",
					"api/message-scroller.ts",
				]);
			} finally {
				rmSync(scratch, { recursive: true, force: true });
			}
		},
		GENERATOR_TIMEOUT_MS,
	);
});
