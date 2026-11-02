import { describe, expect, it } from "vitest";

import { localAppCache } from "../../../../../test/support/local-app-cache";
import type { TenantRouteLookup, TenantRouteRecord } from "../../../application/tenancy/tenant-source.port";
import { CachedTenantRouteLookup } from "../cached-tenant-route.lookup";

/** Tenants by route key, counting the database reads. */
class CountingRouteLookup implements TenantRouteLookup {
	public reads = 0;

	public constructor(public readonly tenants: Map<string, TenantRouteRecord>) {}

	public findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		return Promise.resolve([...this.tenants.values()].find((tenant): boolean => tenant.id === tenantId) ?? null);
	}

	public findLiveByRouteKey(routeKey: string): Promise<TenantRouteRecord | null> {
		this.reads += 1;
		return Promise.resolve(this.tenants.get(routeKey) ?? null);
	}
}

const ACME: TenantRouteRecord = { id: "tenant-acme", slug: "acme", lifecycleState: "ACTIVE" };

describe("CachedTenantRouteLookup", () => {
	it("reads a slug once, then answers from the cache", async () => {
		const source = new CountingRouteLookup(new Map([["acme", ACME]]));
		const lookup = new CachedTenantRouteLookup(source, localAppCache());

		await lookup.findLiveByRouteKey("acme");
		expect(await lookup.findLiveByRouteKey("acme")).toEqual(ACME);
		expect(source.reads).toBe(1);
	});

	it("never caches an unknown slug, so a tenant created a moment later resolves at once", async () => {
		const source = new CountingRouteLookup(new Map());
		const lookup = new CachedTenantRouteLookup(source, localAppCache());

		expect(await lookup.findLiveByRouteKey("acme")).toBeNull();
		source.tenants.set("acme", ACME);
		expect(await lookup.findLiveByRouteKey("acme")).toEqual(ACME);
	});

	it("drops every route key of a tenant when its lifecycle changes", async () => {
		const source = new CountingRouteLookup(
			new Map([
				["acme", ACME],
				["tenant-acme", ACME],
			]),
		);
		const lookup = new CachedTenantRouteLookup(source, localAppCache());
		await lookup.findLiveByRouteKey("acme");
		await lookup.findLiveByRouteKey("tenant-acme");
		const suspended: TenantRouteRecord = { ...ACME, lifecycleState: "SUSPENDED" };
		source.tenants.set("acme", suspended);
		source.tenants.set("tenant-acme", suspended);

		await lookup.invalidateTenant("tenant-acme");

		expect(await lookup.findLiveByRouteKey("acme")).toEqual(suspended);
		expect(await lookup.findLiveByRouteKey("tenant-acme")).toEqual(suspended);
	});
});
