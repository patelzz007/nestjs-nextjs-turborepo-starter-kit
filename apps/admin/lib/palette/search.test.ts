import { describe, expect, it } from "vitest";

import { PERMISSION } from "@workspace/shared";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems, findSuggestion, matchesQuery, parseInput } from "@/lib/palette/search";

const SEARCHABLE_ITEMS = buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, []));

describe("parseInput", () => {
	it("parses scope prefixes", () => {
		expect(parseInput("> commands")).toEqual({ scope: "commands", query: "commands" });
		expect(parseInput("/ files")).toEqual({ scope: "files", query: "files" });
		expect(parseInput("# settings")).toEqual({ scope: "settings", query: "settings" });
		expect(parseInput("billing")).toEqual({ scope: "all", query: "billing" });
	});

	it("strips leading whitespace before the prefix", () => {
		expect(parseInput("  /users")).toEqual({ scope: "files", query: "users" });
	});
});

describe("matchesQuery", () => {
	const breadcrumb = ["Settings"];

	it("matches on title text", () => {
		expect(matchesQuery("General", breadcrumb, "general")).toBe(true);
	});

	it("matches on breadcrumb text", () => {
		expect(matchesQuery("General", breadcrumb, "settings")).toBe(true);
	});

	it("matches aliases", () => {
		expect(matchesQuery("Billing", breadcrumb, "invoice")).toBe(true);
		expect(matchesQuery("Overview", [], "dashboard")).toBe(true);
	});

	it("matches natural-language filler words", () => {
		expect(matchesQuery("Billing", breadcrumb, "go to billing")).toBe(true);
	});

	it("returns false for unrelated queries", () => {
		expect(matchesQuery("Billing", breadcrumb, "zebra")).toBe(false);
	});
});

describe("findSuggestion", () => {
	it("returns null for queries shorter than 3 chars", () => {
		expect(findSuggestion("bi", SEARCHABLE_ITEMS)).toBeNull();
	});

	it("returns null when nothing is close", () => {
		expect(findSuggestion("zzzzzz", SEARCHABLE_ITEMS)).toBeNull();
	});

	it("returns a close match for a typo", () => {
		const suggestion = findSuggestion("bilng", SEARCHABLE_ITEMS);
		expect(suggestion?.title).toBe("Billing");
	});
});

describe("buildSearchableItems (authorized menu)", () => {
	function titles(capabilities: readonly string[], enabledFeatureFlags: readonly string[]): readonly string[] {
		return buildSearchableItems(filterCompiledSidebarMenu(SIDEBAR_MENU, capabilities, { enabledFeatureFlags })).map((item) => item.title);
	}

	it("omits items the session is not authorized for", () => {
		expect(titles([], [])).not.toContain("Products");
	});

	it("includes an item once permission is held", () => {
		expect(titles([PERMISSION.PRODUCT.LIST], [])).toContain("Products");
	});

	it("still lists ungated pages", () => {
		expect(titles([], [])).toContain("Billing");
	});
});
