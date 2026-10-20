import type { TenantLifecycleState } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { TenancyConfigService } from "../../../../config/tenancy.config";
import type { TenantRouteLookup, TenantRouteRecord } from "../../../application/tenancy/tenant-source.port";
import { DefaultTenantMissingError, DefaultTenantService } from "../default-tenant.service";

const LIVE_ORG = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";
const MISSING_ORG = "0f0e0d0c-0b0a-4908-8706-050403020100";

/** Lookup double: {@link LIVE_ORG} exists with `lifecycleState`; every other id is not a live row. */
class KnownTenants implements TenantRouteLookup {
	public readonly lookedUp: string[] = [];

	public constructor(private readonly lifecycleState: TenantLifecycleState = "ACTIVE") {}

	public findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		this.lookedUp.push(tenantId);
		return Promise.resolve(tenantId === LIVE_ORG ? { id: LIVE_ORG, slug: "live", lifecycleState: this.lifecycleState } : null);
	}

	public findLiveByRouteKey(): Promise<TenantRouteRecord | null> {
		return Promise.resolve(null);
	}
}

function service(env: Readonly<Record<string, string | undefined>>, lookup: KnownTenants = new KnownTenants()): DefaultTenantService {
	return new DefaultTenantService(new TenancyConfigService(createTestTypedConfig(env)), lookup);
}

describe("DefaultTenantService", () => {
	it("lets boot continue when the configured tenant is a live row, after checking it", async () => {
		const lookup = new KnownTenants();

		await expect(service({ DEFAULT_TENANT_ID: LIVE_ORG }, lookup).onModuleInit()).resolves.toBeUndefined();

		expect(lookup.lookedUp).toEqual([LIVE_ORG]);
	});

	it("ST-003: refuses to start when the configured tenant does not exist", async () => {
		await expect(service({ DEFAULT_TENANT_ID: MISSING_ORG }).onModuleInit()).rejects.toBeInstanceOf(DefaultTenantMissingError);
	});

	it("refuses to start when the configured tenant's lifecycle is DELETED, though its row is not soft-deleted", async () => {
		await expect(service({ DEFAULT_TENANT_ID: LIVE_ORG }, new KnownTenants("DELETED")).onModuleInit()).rejects.toBeInstanceOf(DefaultTenantMissingError);
	});

	it.each<TenantLifecycleState>(["SUSPENDED", "PROVISIONING", "PENDING_DELETION", "RESTRICTED"])("boots a %s tenant: its lifecycle routes still serve", async (state) => {
		await expect(service({ DEFAULT_TENANT_ID: LIVE_ORG }, new KnownTenants(state)).onModuleInit()).resolves.toBeUndefined();
	});

	it("resolves nothing in multi-tenant mode (no fallback tenant) and never queries", async () => {
		const lookup = new KnownTenants();

		await service({ TENANCY_ENABLED: "true", DEFAULT_TENANT_ID: undefined }, lookup).onModuleInit();

		expect(lookup.lookedUp).toEqual([]);
	});
});
