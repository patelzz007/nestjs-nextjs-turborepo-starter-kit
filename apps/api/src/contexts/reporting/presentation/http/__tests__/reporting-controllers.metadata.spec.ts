import { RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RewardsAdminAnalyticsController } from "../admin-analytics.controller";
import { AnalyticsExportRateLimitGuard } from "../analytics-export-rate-limit.guard";
import { ConsumerAnalyticsController } from "../consumer-analytics.controller";
import { OrganizationAnalyticsController } from "../organization-analytics.controller";

const reflector = new Reflector();

interface RouteMetadata {
	readonly path: string | undefined;
	readonly method: RequestMethod | undefined;
	readonly guards: readonly object[];
}

/** What `Reflector.get` reads metadata off: a controller class or one of its methods. */
type MetadataTarget = Parameters<Reflector["get"]>[1];

/** The routing metadata of one decorated controller method (read off its property descriptor). */
function routeOf(prototype: object, name: string): RouteMetadata {
	const descriptor: TypedPropertyDescriptor<MetadataTarget> | undefined = Object.getOwnPropertyDescriptor(prototype, name);
	const handler: MetadataTarget | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`${name} is not a controller method`);
	}
	return {
		path: reflector.get<string | undefined>(PATH_METADATA, handler),
		method: reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler),
		guards: reflector.get<object[] | undefined>(GUARDS_METADATA, handler) ?? [],
	};
}

describe("reporting controllers keep every analytics route", () => {
	it("serves the merchant routes under /orgs/:orgSlug/analytics, the export behind the rate limit", () => {
		const prototype = OrganizationAnalyticsController.prototype;
		expect(reflector.get<string>(PATH_METADATA, OrganizationAnalyticsController)).toBe(`${API_VERSION_PREFIX}/orgs/:orgSlug/analytics`);
		expect(routeOf(prototype, "getAnalytics")).toEqual({ path: "/", method: RequestMethod.GET, guards: [] });
		expect(routeOf(prototype, "getDashboard")).toEqual({ path: "dashboard", method: RequestMethod.GET, guards: [] });
		expect(routeOf(prototype, "exportReport")).toEqual({ path: "export", method: RequestMethod.GET, guards: [AnalyticsExportRateLimitGuard] });
	});

	it("serves the admin routes under /admin/analytics, the export behind the rate limit", () => {
		const prototype = RewardsAdminAnalyticsController.prototype;
		expect(reflector.get<string>(PATH_METADATA, RewardsAdminAnalyticsController)).toBe(`${API_VERSION_PREFIX}/admin/analytics`);
		expect(routeOf(prototype, "getSales")).toEqual({ path: "sales", method: RequestMethod.GET, guards: [] });
		expect(routeOf(prototype, "getDashboard")).toEqual({ path: "dashboard", method: RequestMethod.GET, guards: [] });
		expect(routeOf(prototype, "exportReport")).toEqual({ path: "export", method: RequestMethod.GET, guards: [AnalyticsExportRateLimitGuard] });
	});

	it("serves the customer routes under /claims", () => {
		const prototype = ConsumerAnalyticsController.prototype;
		expect(reflector.get<string>(PATH_METADATA, ConsumerAnalyticsController)).toBe(`${API_VERSION_PREFIX}/claims`);
		expect(routeOf(prototype, "getAnalytics")).toEqual({ path: "analytics", method: RequestMethod.GET, guards: [] });
		expect(routeOf(prototype, "getAnalyticsDashboard")).toEqual({ path: "analytics/dashboard", method: RequestMethod.GET, guards: [] });
	});
});
