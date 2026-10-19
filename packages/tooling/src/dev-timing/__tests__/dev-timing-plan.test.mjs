import { describe, expect, it } from "vitest";

import { COLD_RESET_PATHS, DEV_SERVERS, METRO_MANIFEST_HEADERS, METRO_MANIFEST_PATH, PAGE_TARGETS, PHASES, localUrl, metroCacheRoots } from "../dev-timing-plan.mjs";

describe("dev-timing plan", () => {
	it("waits on every app pnpm dev boots, each on its own port", () => {
		expect(DEV_SERVERS.map(({ id, port }) => `${id}:${String(port)}`)).toEqual(["api:8080", "web:3000", "admin:3001", "docs:3002", "merchant:3003", "mobile:8081"]);
	});

	it("uses the API readiness probe and Metro's status endpoint", () => {
		expect(DEV_SERVERS.find(({ id }) => id === "api")).toMatchObject({ path: "/health/ready", readiness: "ok" });
		expect(DEV_SERVERS.find(({ id }) => id === "mobile")).toMatchObject({ path: "/status", readiness: "metro" });
	});

	it("measures the plan's representative route per Next app, on that app's port", () => {
		expect(PAGE_TARGETS.map(({ id, path }) => `${id} ${path}`)).toEqual(["web /dashboard", "admin /", "merchant /orgs/brew-bean-kl/dashboard"]);
		for (const page of PAGE_TARGETS) {
			expect(page.port).toBe(DEV_SERVERS.find(({ id }) => id === page.id)?.port);
			expect(page.account.clientType).toBe(page.id);
			expect(page.account.origin).toBe(localUrl(page.port, ""));
		}
	});

	it("asks Metro for the iOS manifest, which names the development bundle", () => {
		expect(METRO_MANIFEST_PATH).toBe("/");
		expect(METRO_MANIFEST_HEADERS).toMatchObject({ "expo-platform": "ios" });
	});

	it("resets turbo, every Next build and the API bundle on a cold run, and nothing outside the repo", () => {
		expect(COLD_RESET_PATHS).toEqual([".turbo", "apps/web/.next", "apps/admin/.next", "apps/merchant/.next", "apps/api/dist"]);
		expect(COLD_RESET_PATHS.every((relative) => !relative.startsWith("/") && !relative.includes(".."))).toBe(true);
	});

	it("clears Metro's caches in this process's temp directory and in the /tmp a turbo task sees", () => {
		expect(metroCacheRoots("/var/folders/ab/T")).toEqual(["/var/folders/ab/T", "/tmp"]);
		expect(metroCacheRoots("/tmp")).toEqual(["/tmp"]);
	});

	it("names the four phases A–D", () => {
		expect(Object.values(PHASES).map(({ id }) => id)).toEqual(["A", "B", "C", "D"]);
	});
});
