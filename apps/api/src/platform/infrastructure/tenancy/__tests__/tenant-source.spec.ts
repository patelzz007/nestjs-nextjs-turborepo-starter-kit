import { NotFoundError } from "../../../application/errors/app-error";
import { TenancyConfigService } from "../../../../config/tenancy.config";
import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import type { TenantRouteLookup, TenantRouteRecord } from "../../../application/tenancy/tenant-source.port";
import { FixedTenantSource } from "../fixed-tenant.source";
import { RouteTenantSource } from "../route-tenant.source";

const TENANT_ID = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";
const OTHER_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";

const HOME: TenantRouteRecord = { id: TENANT_ID, slug: "jonker-street-kitchen", lifecycleState: "ACTIVE" };
const OTHER: TenantRouteRecord = { id: OTHER_ID, slug: "other-cafe", lifecycleState: "ACTIVE" };

class FakeLookup implements TenantRouteLookup {
	/** Every lookup made, in order. */
	public readonly calls: string[] = [];

	public constructor(
		private readonly byId: ReadonlyMap<string, TenantRouteRecord>,
		private readonly byKey: ReadonlyMap<string, TenantRouteRecord>,
	) {}

	public findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		this.calls.push(`id:${tenantId}`);
		return Promise.resolve(this.byId.get(tenantId) ?? null);
	}

	public findLiveByRouteKey(routeKey: string): Promise<TenantRouteRecord | null> {
		this.calls.push(`key:${routeKey}`);
		return Promise.resolve(this.byKey.get(routeKey) ?? null);
	}
}

function lookup(): FakeLookup {
	return new FakeLookup(
		new Map([
			[HOME.id, HOME],
			[OTHER.id, OTHER],
		]),
		new Map([
			[HOME.id, HOME],
			[HOME.slug, HOME],
			["old-jonker", HOME],
			[OTHER.id, OTHER],
			[OTHER.slug, OTHER],
		]),
	);
}

describe("FixedTenantSource", () => {
	const source = new FixedTenantSource(new TenancyConfigService(createTestTypedConfig({ DEFAULT_TENANT_ID: TENANT_ID })), lookup());

	it("returns none when the route names no slug, as multi mode does: customer, platform and public routes are tenantless", async () => {
		await expect(source.resolve({})).resolves.toEqual({ kind: "none" });
	});

	it("returns the default tenant for its current slug, its id, and a previous slug", async () => {
		await expect(source.resolve({ tenantSlug: HOME.slug })).resolves.toMatchObject({ tenantId: TENANT_ID });
		await expect(source.resolve({ tenantSlug: TENANT_ID })).resolves.toMatchObject({ tenantId: TENANT_ID });
		await expect(source.resolve({ tenantSlug: "old-jonker" })).resolves.toMatchObject({ tenantId: TENANT_ID });
	});

	it("answers 404 when the slug names another tenant", async () => {
		await expect(source.resolve({ tenantSlug: OTHER.slug })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("resolves a request with one lookup by route key (the default tenant was verified at boot)", async () => {
		const counted = lookup();
		const single = new FixedTenantSource(new TenancyConfigService(createTestTypedConfig({ DEFAULT_TENANT_ID: TENANT_ID })), counted);

		await single.resolve({ tenantSlug: "old-jonker" });

		expect(counted.calls).toEqual(["key:old-jonker"]);
	});
});

describe("RouteTenantSource", () => {
	const source = new RouteTenantSource(lookup());

	it("returns none when the route has no slug", async () => {
		await expect(source.resolve({})).resolves.toEqual({ kind: "none" });
	});

	it("resolves the current slug, a previous slug, and the id", async () => {
		await expect(source.resolve({ tenantSlug: OTHER.slug })).resolves.toEqual({ kind: "tenant", tenantId: OTHER_ID, lifecycleState: "ACTIVE" });
		await expect(source.resolve({ tenantSlug: "old-jonker" })).resolves.toMatchObject({ tenantId: TENANT_ID });
		await expect(source.resolve({ tenantSlug: TENANT_ID })).resolves.toMatchObject({ tenantId: TENANT_ID });
	});

	it("answers 404 when nothing matches the slug", async () => {
		await expect(source.resolve({ tenantSlug: "missing" })).rejects.toBeInstanceOf(NotFoundError);
	});
});
