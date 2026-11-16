import { describe, expect, it } from "vitest";

import { placementOf, type TreeRow } from "../notion-tree.ts";

function row(id: string, overrides: Partial<TreeRow> = {}): TreeRow {
	return { id, kind: "folder", title: id, ownSlug: id, parentIds: [], ...overrides };
}

function tree(...rows: readonly TreeRow[]): ReadonlyMap<string, TreeRow> {
	return new Map(rows.map((each) => [each.id, each]));
}

const technical = row("technical");
const api = row("api", { parentIds: ["technical"] });

function reasonsOf(page: TreeRow, rows: ReadonlyMap<string, TreeRow>): readonly string[] {
	return placementOf(page, rows).issues.map((issue) => issue.reason);
}

describe("placementOf", () => {
	it("joins the folder slugs above a page to its own", () => {
		const page = row("rest", { kind: "page", ownSlug: "rest-conventions", parentIds: ["api"] });

		expect(placementOf(page, tree(technical, api, page))).toEqual({ slug: "technical/api/rest-conventions", issues: [] });
	});

	it("puts a page with no Parent at the top", () => {
		const page = row("readme", { kind: "page", ownSlug: "README" });

		expect(placementOf(page, tree(page))).toEqual({ slug: "README", issues: [] });
	});

	it("leaves a page with no Slug to the shared 'no slug' rule", () => {
		expect(placementOf(row("p", { kind: "page", ownSlug: null }), tree())).toEqual({ slug: null, issues: [] });
	});

	it("refuses a '/' in a Slug, on the page or on a folder above it", () => {
		const page = row("p", { kind: "page", ownSlug: "api/rest" });
		const slashedFolder = row("f", { ownSlug: "a/b", title: "Odd" });

		expect(reasonsOf(page, tree(page))).toEqual(['This page\'s Slug "api/rest" has a "/" in it.']);
		expect(reasonsOf(row("q", { kind: "page", ownSlug: "q", parentIds: ["f"] }), tree(slashedFolder))).toEqual(['The folder "Odd"\'s Slug "a/b" has a "/" in it.']);
	});

	it("refuses a folder with no Slug above the page", () => {
		const blank = row("f", { ownSlug: null, title: "Guides" });

		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["f"] }), tree(blank))).toEqual(['The folder "Guides" has no Slug.']);
	});

	it("refuses more than one Parent", () => {
		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["technical", "api"] }), tree(technical, api))).toEqual(["This page has more than one Parent."]);
	});

	it("refuses a Parent that is not a published folder (unpublished, unshared or trashed)", () => {
		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["gone"] }), tree())).toEqual(["The Parent of this page is not a published folder."]);
		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["api"] }), tree(api))).toEqual(['The Parent of the folder "api" is not a published folder.']);
	});

	it("refuses a page inside another page", () => {
		const host = row("host", { kind: "page", ownSlug: "host", title: "Host" });

		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["host"] }), tree(host))).toEqual(['The Parent of this page is the page "Host", not a folder.']);
	});

	it("refuses folders that go round in a circle", () => {
		const a = row("a", { parentIds: ["b"] });
		const b = row("b", { parentIds: ["a"] });

		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["a"] }), tree(a, b))).toEqual(['The folder "a" is inside itself.']);
	});

	it("refuses a page more than 20 folders deep", () => {
		const folders = Array.from({ length: 21 }, (_unused, index) => row(`f${String(index)}`, { parentIds: index === 0 ? [] : [`f${String(index - 1)}`] }));

		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["f20"] }), tree(...folders))).toEqual(["This page is more than 20 folders deep."]);
	});

	it("names an untitled folder the way Notion shows it", () => {
		const untitled = row("f", { ownSlug: null, title: "" });

		expect(reasonsOf(row("p", { kind: "page", ownSlug: "p", parentIds: ["f"] }), tree(untitled))).toEqual(['The folder "Untitled" has no Slug.']);
	});
});
