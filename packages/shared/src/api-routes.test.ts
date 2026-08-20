import { describe, expect, it } from "vitest";

import { apiRoutes, buildQuery, buildRoute } from "./api-routes";

// ── apiRoutes shape ────────────────────────────────────────────────────────

describe("apiRoutes", () => {
	it("has all top-level groups", () => {
		expect(Object.keys(apiRoutes)).toEqual(["auth", "email", "backup", "telescope"]);
	});

	it("static routes are plain strings", () => {
		expect(typeof apiRoutes.telescope.requests).toBe("string");
		expect(apiRoutes.telescope.requests).toBe("/telescope/requests");
	});

	it("parameterized routes have path + params", () => {
		const route = apiRoutes.telescope.requestDetail;
		expect(typeof route).not.toBe("string");
		expect(route).toHaveProperty("path", "/telescope/requests/:id");
		expect(route).toHaveProperty("params");
	});
});

// ── buildRoute ─────────────────────────────────────────────────────────────

describe("buildRoute", () => {
	it("returns static routes as-is", () => {
		expect(buildRoute(apiRoutes.telescope.requests)).toBe("/telescope/requests");
		expect(buildRoute(apiRoutes.auth.me)).toBe("/auth/me");
		expect(buildRoute(apiRoutes.backup.list)).toBe("/backup");
	});

	it("resolves single param", () => {
		const result = buildRoute(apiRoutes.telescope.requestDetail, { id: "abc-123" });
		expect(result).toBe("/telescope/requests/abc-123");
	});

	it("resolves numeric params", () => {
		const result = buildRoute(apiRoutes.telescope.requestDetail, { id: 42 });
		expect(result).toBe("/telescope/requests/42");
	});

	it("resolves multiple params", () => {
		const result = buildRoute(apiRoutes.email.previewSend, { key: "welcome-email" });
		expect(result).toBe("/notifications/email-preview/welcome-email/send");
	});

	it("resolves backup routes", () => {
		expect(buildRoute(apiRoutes.backup.status, { id: "bk-001" })).toBe("/backup/bk-001");
		expect(buildRoute(apiRoutes.backup.download, { id: "bk-001" })).toBe("/backup/bk-001/download");
		expect(buildRoute(apiRoutes.backup.toggleSchedule, { id: "sch-1" })).toBe("/backup/schedules/sch-1/toggle");
	});

	it("resolves telescope mutation routes", () => {
		expect(buildRoute(apiRoutes.telescope.setAnnotation, { id: "req-1" })).toBe("/telescope/requests/req-1/annotation");
		expect(buildRoute(apiRoutes.telescope.replay, { id: "req-1" })).toBe("/telescope/replay/req-1");
		expect(buildRoute(apiRoutes.telescope.runSchedule, { name: "hourly" })).toBe("/telescope/schedules/hourly/run");
		expect(buildRoute(apiRoutes.telescope.alertAck, { id: "al-1" })).toBe("/telescope/alerts/al-1/ack");
	});

	it("throws on missing param", () => {
		expect(() => buildRoute(apiRoutes.telescope.requestDetail, {} as Record<string, string | number>)).toThrow("Missing required parameter: id");
	});

	it("throws on missing multiple params", () => {
		expect(() => buildRoute(apiRoutes.email.previewSend, {} as Record<string, string | number>)).toThrow("Missing required parameter: key");
	});

	it("does not throw on extra params (ignored)", () => {
		const result = buildRoute(apiRoutes.telescope.requestDetail, { id: "x", extra: "ignored" } as Record<string, string | number>);
		expect(result).toBe("/telescope/requests/x");
	});
});

// ── buildQuery ─────────────────────────────────────────────────────────────

describe("buildQuery", () => {
	it("returns base when no params", () => {
		expect(buildQuery("/telescope/requests", {})).toBe("/telescope/requests");
	});

	it("appends single param", () => {
		expect(buildQuery("/telescope/requests", { sort: "duration" })).toBe("/telescope/requests?sort=duration");
	});

	it("appends multiple params", () => {
		const result = buildQuery("/telescope/requests", { sort: "duration", starred: true, page: 1 });
		expect(result).toBe("/telescope/requests?sort=duration&starred=true&page=1");
	});

	it("omits null values", () => {
		const result = buildQuery("/telescope/requests", { sort: "duration", filter: null });
		expect(result).toBe("/telescope/requests?sort=duration");
	});

	it("omits undefined values", () => {
		const result = buildQuery("/telescope/requests", { sort: "duration", filter: undefined });
		expect(result).toBe("/telescope/requests?sort=duration");
	});

	it("encodes special characters", () => {
		const result = buildQuery("/search", { q: "hello world&foo=bar" });
		expect(result).toBe("/search?q=hello%20world%26foo%3Dbar");
	});
});

// ── buildRoute + buildQuery combined ───────────────────────────────────────

describe("buildRoute + buildQuery combined", () => {
	it("builds a full parameterized URL with query", () => {
		const base = buildRoute(apiRoutes.telescope.requests);
		const url = buildQuery(base, { sort: "duration", page: 2 });
		expect(url).toBe("/telescope/requests?sort=duration&page=2");
	});

	it("builds a param route then appends query", () => {
		const base = buildRoute(apiRoutes.telescope.requestDetail, { id: "req-123" });
		const url = buildQuery(base, { tab: "sql" });
		expect(url).toBe("/telescope/requests/req-123?tab=sql");
	});
});
