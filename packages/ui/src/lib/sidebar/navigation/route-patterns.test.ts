import { describe, expect, it } from "vitest";

import { findMostSpecificRoute, isDynamicRouteSegment, matchRoutePattern, routeParam, samplePathForPattern } from "./route-patterns";

interface Entry {
	readonly name: string;
	readonly pattern: string;
}

const ENTRIES: readonly Entry[] = [
	{ name: "home", pattern: "/" },
	{ name: "products", pattern: "/catalog/products" },
	{ name: "product-new", pattern: "/catalog/products/new" },
	{ name: "product-detail", pattern: "/catalog/products/[id]" },
	{ name: "product-edit", pattern: "/catalog/products/[id]/edit" },
];

function nameFor(pathname: string, mode: "exact" | "prefix"): string | null {
	return findMostSpecificRoute(ENTRIES, (entry) => entry.pattern, pathname, mode)?.name ?? null;
}

describe("isDynamicRouteSegment", () => {
	it("recognises single dynamic segments only", () => {
		expect(isDynamicRouteSegment("[id]")).toBe(true);
		expect(isDynamicRouteSegment("[rewardId]")).toBe(true);
		expect(isDynamicRouteSegment("id")).toBe(false);
		expect(isDynamicRouteSegment("[...slug]")).toBe(false);
		expect(isDynamicRouteSegment("[[...slug]]")).toBe(false);
		expect(isDynamicRouteSegment("[]")).toBe(false);
	});
});

describe("routeParam", () => {
	it("builds the App Router segment for a parameter", () => {
		expect(routeParam("claimId")).toBe("[claimId]");
		expect(isDynamicRouteSegment(routeParam("claimId"))).toBe(true);
	});
});

describe("matchRoutePattern", () => {
	it("matches static and dynamic segments exactly", () => {
		expect(matchRoutePattern("/catalog/products/[id]", "/catalog/products/42", "exact")).toEqual({ depth: 3, staticSegments: 2 });
		expect(matchRoutePattern("/catalog/products/[id]", "/catalog/products", "exact")).toBeNull();
		expect(matchRoutePattern("/catalog/products/[id]", "/catalog/products/42/edit", "exact")).toBeNull();
		expect(matchRoutePattern("/catalog/products", "/catalog/productsx", "exact")).toBeNull();
	});

	it("lets a prefix pattern cover deeper paths on segment boundaries only", () => {
		expect(matchRoutePattern("/catalog/products", "/catalog/products/42/edit", "prefix")).toEqual({ depth: 2, staticSegments: 2 });
		expect(matchRoutePattern("/catalog/products", "/catalog/products-archive", "prefix")).toBeNull();
		expect(matchRoutePattern("/catalog/products/[id]", "/catalog/products", "prefix")).toBeNull();
	});

	it("treats the root pattern as covering only the root, in both modes", () => {
		expect(matchRoutePattern("/", "/", "exact")).toEqual({ depth: 0, staticSegments: 0 });
		expect(matchRoutePattern("/", "/", "prefix")).toEqual({ depth: 0, staticSegments: 0 });
		expect(matchRoutePattern("/", "/catalog", "prefix")).toBeNull();
	});

	it("ignores query strings, fragments and trailing slashes", () => {
		expect(matchRoutePattern("/catalog/products", "/catalog/products?page=2", "exact")).not.toBeNull();
		expect(matchRoutePattern("/catalog/products", "/catalog/products#top", "exact")).not.toBeNull();
		expect(matchRoutePattern("/catalog/products", "/catalog/products/", "exact")).not.toBeNull();
	});
});

describe("findMostSpecificRoute", () => {
	it("prefers the deepest matching pattern", () => {
		expect(nameFor("/catalog/products/42/edit", "prefix")).toBe("product-edit");
		expect(nameFor("/catalog/products/42", "prefix")).toBe("product-detail");
		expect(nameFor("/catalog/products/42/history", "prefix")).toBe("product-detail");
	});

	it("prefers a literal segment over a dynamic one at the same depth", () => {
		expect(nameFor("/catalog/products/new", "exact")).toBe("product-new");
		expect(nameFor("/catalog/products/new", "prefix")).toBe("product-new");
	});

	it("returns null when nothing matches", () => {
		expect(nameFor("/settings", "prefix")).toBeNull();
		expect(nameFor("/catalog/products/42/history", "exact")).toBeNull();
	});

	it("resolves the root page only for the root path", () => {
		expect(nameFor("/", "exact")).toBe("home");
		expect(nameFor("/unknown", "prefix")).toBeNull();
	});
});

describe("samplePathForPattern", () => {
	it("fills every dynamic segment with the sample value", () => {
		expect(samplePathForPattern("/catalog/products/[id]/edit", "sample")).toBe("/catalog/products/sample/edit");
		expect(samplePathForPattern("/catalog/products", "sample")).toBe("/catalog/products");
		expect(samplePathForPattern("/", "sample")).toBe("/");
	});
});
