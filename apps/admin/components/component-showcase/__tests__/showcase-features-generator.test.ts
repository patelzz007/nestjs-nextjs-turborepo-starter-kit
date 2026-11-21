import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SHOWCASE_FEATURE_INDEX } from "@/components/component-showcase/generated/feature-index";
import { SHOWCASE_FEATURE_SETS } from "@/components/component-showcase/generated/feature-sets";
import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";

import {
	anchorOf,
	COMPONENTS_DIR,
	componentModuleSource,
	EXAMPLES_DIR,
	FEATURE_INDEX_FILE,
	FEATURE_SETS_FILE,
	featureIndexSource,
	featureSetsSource,
	parseGuidelines,
	parseManifest,
	partsOf,
	pascalCaseOf,
	readComponentFeatures,
	STATIC_EXAMPLES_DIR,
	STATIC_EXAMPLES_INDEX_FILE,
	staticExamplesIndexSource,
	staticExamplesSource,
	uniqueAnchors,
	type ComponentFeatures,
} from "../../../scripts/showcase-features";

import { formattedAll, ROOT } from "./formatted-sources";

/** Generating and formatting every module takes a few seconds. */
const FRESHNESS_TIMEOUT_MS = 60_000;

const COMPONENTS: readonly ComponentFeatures[] = readComponentFeatures(ROOT);
const CATALOG_SLUGS: readonly string[] = SHOWCASE_CATALOG_ORDER.map((item) => item.entry.slug);
const SAMPLE: ComponentFeatures = {
	slug: "icon-tile",
	features: [
		{
			id: "c-icon-tile-1",
			label: "Basic",
			description: "A tile with an icon.",
			file: "icon-tile-1",
			export: "IconTile1Example",
			anchor: "basic",
			source: "a\nb\n",
			part: null,
		},
	],
	parts: [],
	guidelines: [
		{
			title: "Name the tile",
			do: { text: "Give it a label.", file: "icon-tile-do-1", export: "IconTileDo1Example", source: "do\n" },
			dont: { text: "Don't leave it bare.", file: "icon-tile-dont-1", export: "IconTileDont1Example", source: "dont\n" },
		},
	],
};

const SIDE = { text: "Say what it does.", file: "button-do-1", export: "ButtonDo1Example" };
const PAIR = { title: "Say what it does", do: SIDE, dont: { ...SIDE, file: "button-dont-1", export: "ButtonDont1Example" } };

describe("showcase feature generator", () => {
	it("names modules and anchors predictably", () => {
		expect(pascalCaseOf("data-grid")).toBe("DataGrid");
		expect(anchorOf("Diagnostics & Actions")).toBe("diagnostics-actions");
		expect(anchorOf("  Before / After ")).toBe("before-after");
		expect(uniqueAnchors(["Basic", "Basic", "Sizes", "basic"])).toEqual(["basic", "basic-2", "sizes", "basic-3"]);
	});

	it("refuses a malformed manifest and names the folder", () => {
		expect(() => parseManifest("button", JSON.stringify([]))).toThrow(`${EXAMPLES_DIR}/button/features.json`);
		const valid = { id: "c-button-1", label: "Basic", description: "The default button.", file: "button-1", export: "Button1Example" };
		expect(() => parseManifest("button", JSON.stringify([{ ...valid, id: "x" }]))).toThrow(/button/u);
		expect(() => parseManifest("button", JSON.stringify([{ ...valid, label: "" }]))).toThrow(/button/u);
		expect(() => parseManifest("button", JSON.stringify([{ ...valid, description: "" }]))).toThrow(/button/u);
		expect(parseManifest("button", JSON.stringify([valid]))).toHaveLength(1);
	});

	it("needs at least two Do / Don't pairs, each side with its advice and its example", () => {
		expect(() => parseGuidelines("button", JSON.stringify([PAIR]))).toThrow(`${EXAMPLES_DIR}/button/guidelines.json`);
		expect(() => parseGuidelines("button", JSON.stringify([PAIR, { ...PAIR, dont: { ...PAIR.dont, text: "" } }]))).toThrow(/button/u);
		expect(parseGuidelines("button", JSON.stringify([PAIR, PAIR]))).toHaveLength(2);
	});

	it("writes each component's pairs into its module, live, with their sources, and into the static examples", () => {
		const generatedModule = componentModuleSource(SAMPLE);
		expect(generatedModule).toContain('import("@/components/component-showcase/examples/icon-tile/icon-tile-do-1").then((m) => m.IconTileDo1Example)');
		expect(generatedModule).toContain('title: "Name the tile"');
		expect(generatedModule).toContain("render: (): React.JSX.Element => <Guideline2 />");
		expect(generatedModule).toContain("<ShowcaseFeatureList features={FEATURES} guidelines={GUIDELINES} part={part} />");
		expect(staticExamplesSource(SAMPLE)).toContain('{ file: "icon-tile-dont-1", component: IconTileDont1Example }');
		expect(staticExamplesIndexSource(["icon-tile"])).toContain('["icon-tile", IconTileGuidelines]');
	});

	it("writes each module's entries from the manifest", () => {
		expect(featureIndexSource([SAMPLE])).toContain('["icon-tile", [{ id: "c-icon-tile-1", label: "Basic", anchor: "basic", part: null }]]');
		const generatedModule = componentModuleSource(SAMPLE);
		expect(generatedModule).toContain('import("@/components/component-showcase/examples/icon-tile/icon-tile-1").then((m) => m.IconTile1Example)');
		expect(generatedModule).toContain('source: "a\\nb\\n"');
		expect(generatedModule).toContain('description: "A tile with an icon."');
		expect(generatedModule).toContain("export function IconTileFeatures({ part }: ShowcaseFeatureSetProps)");
		expect(featureSetsSource(["icon-tile"])).toContain('["icon-tile", (part: string | null): React.JSX.Element => <IconTileFeatures part={part} />]');
	});

	it("splits a page into parts when the features name their groups, in first-seen order", () => {
		const valid = { id: "c-table-1", label: "Basic", description: "A table.", file: "table-1", export: "Table1Example" };
		const manifest = parseManifest(
			"table",
			JSON.stringify([
				{ ...valid, group: "Finding rows" },
				{ ...valid, id: "c-table-2", group: "Recipes: analytics" },
				{ ...valid, id: "c-table-3", group: "Finding rows" },
			]),
		);
		expect(partsOf(manifest)).toEqual([
			{ id: "finding-rows", label: "Finding rows" },
			{ id: "recipes-analytics", label: "Recipes: analytics" },
		]);
		expect(partsOf(parseManifest("table", JSON.stringify([valid])))).toEqual([]);
		const split: ComponentFeatures = { ...SAMPLE, features: SAMPLE.features.map((feature) => ({ ...feature, part: "basics" })), parts: [{ id: "basics", label: "Basics" }] };
		expect(featureIndexSource([split])).toContain('part: "basics"');
		expect(featureIndexSource([split])).toContain('["icon-tile", [{ id: "basics", label: "Basics" }]]');
		expect(featureIndexSource([SAMPLE])).toContain("new Map<string, readonly ShowcasePart[]>([\n\n]);");
	});

	it("refuses a manifest where only some features name a group, or a group that would take the docs route", () => {
		const valid = { id: "c-table-1", label: "Basic", description: "A table.", file: "table-1", export: "Table1Example" };
		expect(() =>
			parseManifest(
				"table",
				JSON.stringify([
					{ ...valid, group: "Basics" },
					{ ...valid, id: "c-table-2" },
				]),
			),
		).toThrow(/every feature names its group/u);
		expect(() => partsOf(parseManifest("table", JSON.stringify([{ ...valid, group: "Docs" }])))).toThrow(/docs page's route/u);
		expect(staticExamplesSource(SAMPLE)).toContain('import { IconTile1Example } from "@/components/component-showcase/examples/icon-tile/icon-tile-1";');
	});

	it("has a feature folder for every catalog component, and no folder the catalog does not list", () => {
		expect(COMPONENTS.map(({ slug }) => slug).sort()).toEqual([...CATALOG_SLUGS].sort());
		expect([...SHOWCASE_FEATURE_INDEX.keys()].sort()).toEqual([...CATALOG_SLUGS].sort());
		expect([...SHOWCASE_FEATURE_SETS.keys()].sort()).toEqual([...CATALOG_SLUGS].sort());
	});

	it("gives every feature a unique id, an anchor unique within its component, and a file exporting its named example", () => {
		const ids = COMPONENTS.flatMap(({ features }) => features.map((feature) => feature.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const { slug, features } of COMPONENTS) {
			const anchors = features.map((feature) => feature.anchor);
			expect(new Set(anchors).size, slug).toBe(anchors.length);
			for (const feature of features) {
				expect(feature.source, `${slug}/${feature.file}`).toContain(`export function ${feature.export}(`);
			}
		}
	});

	it("keeps every generated module up to date — run `pnpm showcase:generate`", { timeout: FRESHNESS_TIMEOUT_MS }, () => {
		const slugs = COMPONENTS.map(({ slug }) => slug);
		const expected = new Map<string, string>([
			[FEATURE_INDEX_FILE, featureIndexSource(COMPONENTS)],
			[FEATURE_SETS_FILE, featureSetsSource(slugs)],
			[STATIC_EXAMPLES_INDEX_FILE, staticExamplesIndexSource(slugs)],
			...COMPONENTS.flatMap((component): [string, string][] => [
				[`${COMPONENTS_DIR}/${component.slug}.tsx`, componentModuleSource(component)],
				[`${STATIC_EXAMPLES_DIR}/${component.slug}.ts`, staticExamplesSource(component)],
			]),
		]);
		for (const [file, source] of formattedAll(expected)) {
			expect(readFileSync(path.join(ROOT, file), "utf8"), file).toBe(source);
		}
		expect(readdirSync(path.join(ROOT, COMPONENTS_DIR)).length).toBe(COMPONENTS.length);
		// One module per component, plus the index.
		expect(readdirSync(path.join(ROOT, STATIC_EXAMPLES_DIR)).length).toBe(COMPONENTS.length + 1);
	});
});
