import { SHOWCASE_API } from "../generated/api";
import { SHOWCASE_CODE } from "../generated/code";
import { SHOWCASE_CONTENT } from "../generated/content";
import { SHOWCASE_FEATURE_INDEX } from "../generated/feature-index";
import { SHOWCASE_FEATURE_SETS } from "../generated/feature-sets";
import {
	NOT_SHOWN_MODULES,
	SHOWCASE_CATALOG_ORDER,
	SHOWCASE_ENTRIES,
	SHOWCASE_FAMILIES,
	ShowcaseComponentKeySchema,
	ShowcaseFamilyIdSchema,
	showcaseItemBySlug,
	showcaseNeighbours,
} from "../showcase-catalog";
import { SHOWCASE_FAMILY_META } from "../showcase-family-meta";

const ALL_KEYS = ShowcaseComponentKeySchema.options;
/** The components the web showcase demonstrates: the phone shows every one of them. */
const WEB_COMPONENT_COUNT = 106;
const CATALOG_SLUGS: readonly string[] = SHOWCASE_CATALOG_ORDER.map((item) => item.entry.slug);

describe("the showcase catalog", () => {
	it("shows the web showcase's components, each in exactly one family", () => {
		expect(ALL_KEYS).toHaveLength(WEB_COMPONENT_COUNT);
		const listed = SHOWCASE_FAMILIES.flatMap((family) => family.keys);
		expect([...listed].sort()).toStrictEqual([...ALL_KEYS].sort());
		expect(new Set(listed).size).toBe(listed.length);
	});

	it("gives every family its anchor, in the declared order, with its presentation", () => {
		expect(SHOWCASE_FAMILIES.map((family) => family.id)).toStrictEqual(ShowcaseFamilyIdSchema.options);
		for (const family of SHOWCASE_FAMILIES) {
			expect(family.keys.length).toBeGreaterThan(0);
			expect(SHOWCASE_FAMILY_META[family.id].summary.length).toBeGreaterThan(0);
		}
	});

	it("gives every component a unique slug, anchor and exported name, a description and its kit modules", () => {
		const entries = ALL_KEYS.map((key) => SHOWCASE_ENTRIES[key]);
		expect(new Set(entries.map((entry) => entry.slug)).size).toBe(entries.length);
		expect(new Set(entries.map((entry) => entry.name)).size).toBe(entries.length);
		for (const entry of entries) {
			expect(entry.id).toBe(`component-${entry.slug}`);
			expect(entry.name).toMatch(/^(?:[A-Z][A-Za-z]+|use[A-Z][A-Za-z]+)$/u);
			expect(entry.description.length).toBeGreaterThan(0);
			expect(entry.modules.length).toBeGreaterThan(0);
		}
	});

	it("leaves out only infrastructure, and never a module an entry shows", () => {
		const shown = new Set(ALL_KEYS.flatMap((key) => SHOWCASE_ENTRIES[key].modules));
		for (const { module, reason } of NOT_SHOWN_MODULES) {
			expect(shown.has(module)).toBe(false);
			expect(reason.length).toBeGreaterThan(0);
		}
	});

	it("finds a component by slug, and its neighbours in catalog order", () => {
		expect(showcaseItemBySlug("button")?.key).toBe("button");
		expect(showcaseItemBySlug("no-such-thing")).toBeUndefined();
		const first = SHOWCASE_CATALOG_ORDER.at(0);
		const second = SHOWCASE_CATALOG_ORDER.at(1);
		expect(first === undefined ? null : showcaseNeighbours(first.key)).toStrictEqual({ previous: undefined, next: second });
		const last = SHOWCASE_CATALOG_ORDER.at(-1);
		expect(last === undefined ? null : showcaseNeighbours(last.key).next).toBeUndefined();
	});
});

describe("the generated modules", () => {
	it("have every catalog component's features, examples, code, content and API — and nothing the catalog lacks", () => {
		const sorted = [...CATALOG_SLUGS].sort();
		expect([...SHOWCASE_FEATURE_INDEX.keys()].sort()).toStrictEqual(sorted);
		expect([...SHOWCASE_FEATURE_SETS.keys()].sort()).toStrictEqual(sorted);
		expect([...SHOWCASE_CODE.keys()].sort()).toStrictEqual(sorted);
		expect([...SHOWCASE_CONTENT.keys()].sort()).toStrictEqual(sorted);
		expect([...SHOWCASE_API.keys()].sort()).toStrictEqual(sorted);
	});

	it("load every component's code, content and API reference: its examples' coloured source, its prose, its exports", async () => {
		for (const slug of CATALOG_SLUGS) {
			const features = SHOWCASE_FEATURE_INDEX.get(slug) ?? [];
			const code = await SHOWCASE_CODE.get(slug)?.();
			// One coloured source per example file: every feature's, and each Do / Don't side's.
			expect(code?.size).toBeGreaterThanOrEqual(features.length);
			const content = await SHOWCASE_CONTENT.get(slug)?.();
			expect(content?.overview.whenToUse.length).toBeGreaterThan(0);
			const api = await SHOWCASE_API.get(slug)?.();
			expect(api?.length).toBeGreaterThan(0);
		}
	});

	it("give every component at least one feature, each with a unique anchor", () => {
		for (const [slug, features] of SHOWCASE_FEATURE_INDEX) {
			expect(features.length).toBeGreaterThan(0);
			expect(new Set(features.map((feature) => feature.anchor)).size).toBe(features.length);
			expect(slug.length).toBeGreaterThan(0);
		}
	});
});
