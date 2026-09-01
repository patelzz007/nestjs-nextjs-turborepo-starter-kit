import { describe, expect, it } from "vitest";

import { apiRoutes, buildQuery, buildRoute, isParamRoute, RouteDefSchema, type RouteDef } from "./api-routes";

// ── apiRoutes shape ────────────────────────────────────────────────────────

describe("apiRoutes", () => {
	it("has all top-level groups", () => {
		expect(Object.keys(apiRoutes)).toEqual(["auth", "email", "geo"]);
	});

	it("static routes are plain strings", () => {
		expect(typeof apiRoutes.geo.countries).toBe("string");
		expect(apiRoutes.geo.countries).toBe("/geo/countries");
	});

	it("parameterized routes have path + params", () => {
		const route = apiRoutes.geo.countryDetail;
		expect(typeof route).not.toBe("string");
		expect(route).toHaveProperty("path", "/geo/countries/:id");
		expect(route).toHaveProperty("params");
	});
});

// ── isParamRoute ───────────────────────────────────────────────────────────

describe("isParamRoute", () => {
	it("returns false for static routes", () => {
		expect(isParamRoute("/geo/countries")).toBe(false);
	});

	it("returns true for parameterized routes", () => {
		expect(isParamRoute({ path: "/geo/countries/:id", params: ["id"] })).toBe(true);
	});

	it("returns false for objects missing params", () => {
		// Intentional: tests runtime rejection of a malformed route missing `params`.
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- TS requires the cast to test malformed input.
		const malformed: RouteDef = { path: "/geo/countries/:id" } as RouteDef;
		expect(isParamRoute(malformed)).toBe(false);
	});

	it("returns false for empty params array", () => {
		// Intentional: tests runtime rejection of a route with an empty `params` array.
		const emptyParams: RouteDef = { path: "/geo/countries/:id", params: [] };
		expect(isParamRoute(emptyParams)).toBe(false);
	});
});

// ── RouteDefSchema ─────────────────────────────────────────────────────────

describe("RouteDefSchema", () => {
	it("accepts valid static routes", () => {
		expect(RouteDefSchema.safeParse("/auth/me").success).toBe(true);
	});

	it("accepts valid parameterized routes", () => {
		expect(RouteDefSchema.safeParse({ path: "/geo/countries/:id", params: ["id"] }).success).toBe(true);
	});

	it("rejects empty strings", () => {
		expect(RouteDefSchema.safeParse("").success).toBe(false);
	});

	it("rejects param routes with empty params array", () => {
		expect(RouteDefSchema.safeParse({ path: "/geo/countries/:id", params: [] }).success).toBe(false);
	});

	it("rejects param routes missing path", () => {
		expect(RouteDefSchema.safeParse({ params: ["id"] }).success).toBe(false);
	});

	it("rejects param routes with extra unknown fields", () => {
		expect(RouteDefSchema.safeParse({ path: "/geo/countries/:id", params: ["id"], extra: true }).success).toBe(false);
	});

	it("rejects non-string, non-object values", () => {
		expect(RouteDefSchema.safeParse(42).success).toBe(false);
		expect(RouteDefSchema.safeParse(null).success).toBe(false);
		expect(RouteDefSchema.safeParse(undefined).success).toBe(false);
	});
});

// ── buildRoute ─────────────────────────────────────────────────────────────

describe("buildRoute", () => {
	it("returns static routes as-is", () => {
		expect(buildRoute(apiRoutes.geo.countries)).toBe("/geo/countries");
		expect(buildRoute(apiRoutes.auth.me)).toBe("/auth/me");
		expect(buildRoute(apiRoutes.geo.regions)).toBe("/geo/regions");
	});

	it("resolves single param", () => {
		const result = buildRoute(apiRoutes.geo.countryDetail, { id: "42" });
		expect(result).toBe("/geo/countries/42");
	});

	it("resolves numeric params", () => {
		const result = buildRoute(apiRoutes.geo.countryDetail, { id: 42 });
		expect(result).toBe("/geo/countries/42");
	});

	it("resolves multiple params", () => {
		const result = buildRoute(apiRoutes.email.previewSend, { key: "welcome-email" });
		expect(result).toBe("/notifications/email-preview/welcome-email/send");
	});

	it("resolves geo mutation routes", () => {
		expect(buildRoute(apiRoutes.geo.regionDetail, { id: "1" })).toBe("/geo/regions/1");
		expect(buildRoute(apiRoutes.geo.stateDetail, { id: "5" })).toBe("/geo/states/5");
		expect(buildRoute(apiRoutes.geo.cityDetail, { id: "10" })).toBe("/geo/cities/10");
	});

	it("throws on missing param", () => {
		const emptyParams: Record<string, string | number> = {};
		expect(() => buildRoute(apiRoutes.geo.countryDetail, emptyParams)).toThrow("Missing required parameter: id");
	});

	it("throws on missing multiple params", () => {
		const emptyParams: Record<string, string | number> = {};
		expect(() => buildRoute(apiRoutes.email.previewSend, emptyParams)).toThrow("Missing required parameter: key");
	});

	it("does not throw on extra params (ignored)", () => {
		const params: Record<string, string | number> = { id: "x", extra: "ignored" };
		const result = buildRoute(apiRoutes.geo.countryDetail, params);
		expect(result).toBe("/geo/countries/x");
	});
});

// ── buildQuery ─────────────────────────────────────────────────────────────

describe("buildQuery", () => {
	it("returns base when no params", () => {
		expect(buildQuery("/geo/countries", {})).toBe("/geo/countries");
	});

	it("appends single param", () => {
		expect(buildQuery("/geo/countries", { search: "united" })).toBe("/geo/countries?search=united");
	});

	it("appends multiple params", () => {
		const result = buildQuery("/geo/countries", { search: "united", limit: 10, page: 1 });
		expect(result).toBe("/geo/countries?search=united&limit=10&page=1");
	});

	it("omits null values", () => {
		const result = buildQuery("/geo/countries", { search: "united", filter: null });
		expect(result).toBe("/geo/countries?search=united");
	});

	it("omits undefined values", () => {
		const result = buildQuery("/geo/countries", { search: "united", filter: undefined });
		expect(result).toBe("/geo/countries?search=united");
	});

	it("encodes special characters", () => {
		const result = buildQuery("/search", { q: "hello world&foo=bar" });
		expect(result).toBe("/search?q=hello%20world%26foo%3Dbar");
	});
});

// ── buildRoute + buildQuery combined ───────────────────────────────────────

describe("buildRoute + buildQuery combined", () => {
	it("builds a full parameterized URL with query", () => {
		const base = buildRoute(apiRoutes.geo.countries);
		const url = buildQuery(base, { search: "india", page: 2 });
		expect(url).toBe("/geo/countries?search=india&page=2");
	});

	it("builds a param route then appends query", () => {
		const base = buildRoute(apiRoutes.geo.countryDetail, { id: "101" });
		const url = buildQuery(base, { tab: "states" });
		expect(url).toBe("/geo/countries/101?tab=states");
	});
});
