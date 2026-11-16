import { SHOWCASE_FEATURE_INDEX } from "../generated/feature-index";
import { SHOWCASE_CATALOG_ORDER } from "../showcase-catalog";
import { SHOWCASE_ROUTES } from "../showcase-routes";
import { buildShowcaseSearchEntries, foldForSearch, SHOWCASE_SEARCH_LIMIT, searchShowcase, type ShowcaseSearchEntry } from "../showcase-search-index";

const ENTRIES: readonly ShowcaseSearchEntry[] = buildShowcaseSearchEntries(SHOWCASE_ROUTES);
const TOTAL_FEATURES = [...SHOWCASE_FEATURE_INDEX.values()].reduce((sum, features) => sum + features.length, 0);

describe("showcase search index", () => {
	it("folds case and accents", () => {
		expect(foldForSearch("Fenêtre ÉTÉ")).toBe("fenetre ete");
	});

	it("lists every component and every feature once, with unique keys and their links", () => {
		expect(ENTRIES.filter((entry) => entry.kind === "component")).toHaveLength(SHOWCASE_CATALOG_ORDER.length);
		expect(ENTRIES.filter((entry) => entry.kind === "feature")).toHaveLength(TOTAL_FEATURES);
		expect(new Set(ENTRIES.map((entry) => entry.key)).size).toBe(ENTRIES.length);
		expect(ENTRIES.find((entry) => entry.kind === "feature" && entry.title === "Loading State")).toMatchObject({
			componentName: "Button",
			href: SHOWCASE_ROUTES.feature("button", "loading-state"),
		});
		expect(ENTRIES.find((entry) => entry.key === "component:button")?.href).toStrictEqual(SHOWCASE_ROUTES.component("button"));
	});

	it("ranks title matches first, components before features", () => {
		expect(searchShowcase(ENTRIES, "button").at(0)).toMatchObject({ kind: "component", title: "Button" });
		expect(searchShowcase(ENTRIES, "loading state").at(0)).toMatchObject({ kind: "feature", title: "Loading State" });
	});

	it("requires every word to match, ignoring case and accents", () => {
		expect(searchShowcase(ENTRIES, "BUTTON icon").every((entry) => entry.haystack.includes("button") && entry.haystack.includes("icon"))).toBe(true);
		expect(searchShowcase(ENTRIES, "bùttön").at(0)?.title).toBe("Button");
		expect(searchShowcase(ENTRIES, "zzzz-no-such-thing")).toStrictEqual([]);
	});

	it("shows nothing for a blank query and at most the limit", () => {
		expect(searchShowcase(ENTRIES, "   ")).toStrictEqual([]);
		expect(searchShowcase(ENTRIES, "a").length).toBeLessThanOrEqual(SHOWCASE_SEARCH_LIMIT);
		expect(searchShowcase(ENTRIES, "a", 3)).toHaveLength(3);
	});
});
