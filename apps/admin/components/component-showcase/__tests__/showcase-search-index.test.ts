import { describe, expect, it } from "vitest";

import { SHOWCASE_FEATURE_INDEX } from "@/components/component-showcase/generated/feature-index";
import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";
import {
	buildShowcaseSearchEntries,
	foldForSearch,
	SHOWCASE_SEARCH_LIMIT,
	searchShowcase,
	type ShowcaseSearchEntry,
} from "@/components/component-showcase/showcase-search-index";

const ROUTES = {
	component: (slug: string): string => `/c/${slug}`,
	feature: (slug: string, anchor: string): string => `/c/${slug}#${anchor}`,
};
const ENTRIES: readonly ShowcaseSearchEntry[] = buildShowcaseSearchEntries(ROUTES);
const TOTAL_FEATURES = [...SHOWCASE_FEATURE_INDEX.values()].reduce((sum, features) => sum + features.length, 0);

describe("showcase search index", () => {
	it("folds case and accents", () => {
		expect(foldForSearch("Fenêtre ÉTÉ")).toBe("fenetre ete");
	});

	it("lists every component and every feature once, with unique keys and their links", () => {
		expect(ENTRIES.filter((entry) => entry.kind === "component")).toHaveLength(SHOWCASE_CATALOG_ORDER.length);
		expect(ENTRIES.filter((entry) => entry.kind === "feature")).toHaveLength(TOTAL_FEATURES);
		expect(new Set(ENTRIES.map((entry) => entry.key)).size).toBe(ENTRIES.length);
		const softWrap = ENTRIES.find((entry) => entry.kind === "feature" && entry.title === "Soft Wrap");
		expect(softWrap).toMatchObject({ componentName: "CodeBlock", href: "/c/code-block#soft-wrap" });
		expect(ENTRIES.find((entry) => entry.key === "component:code-block")?.href).toBe("/c/code-block");
	});

	it("finds a feature by its name and ranks title matches first, components before features", () => {
		const results = searchShowcase(ENTRIES, "soft wrap");
		expect(results.at(0)).toMatchObject({ kind: "feature", title: "Soft Wrap", componentName: "CodeBlock" });
		const buttons = searchShowcase(ENTRIES, "button");
		expect(buttons.at(0)).toMatchObject({ kind: "component", title: "Button" });
	});

	it("requires every word to match, ignoring case and accents", () => {
		expect(searchShowcase(ENTRIES, "CODE diff").every((entry) => entry.haystack.includes("code") && entry.haystack.includes("diff"))).toBe(true);
		expect(searchShowcase(ENTRIES, "côde blöck").at(0)?.title).toBe("CodeBlock");
		expect(searchShowcase(ENTRIES, "zzzz-no-such-thing")).toEqual([]);
	});

	it("shows nothing for a blank query and at most the limit", () => {
		expect(searchShowcase(ENTRIES, "   ")).toEqual([]);
		expect(searchShowcase(ENTRIES, "a")).toHaveLength(SHOWCASE_SEARCH_LIMIT);
		expect(searchShowcase(ENTRIES, "a", 3)).toHaveLength(3);
	});
});
