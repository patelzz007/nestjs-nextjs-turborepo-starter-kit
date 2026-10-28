import {
	TenantContextResponseSchema,
	LocationResponseSchema,
	type Envelope,
	type TenantContextResponse,
	type LocationResponse,
	type LocationScopeType,
	type LocationStatus,
} from "@workspace/shared";

import { TEST_ORG_SLUG, type TenantContextSeed } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { STORE_A, STORE_B } from "@/test/terminals";

/** Fixed clock for tenant-context fixtures (2026-10-01T00:00:00Z). */
const FIXTURE_NOW = 1_790_812_800_000;

export const TEST_TENANT_ID = "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11";

export interface StoreRef {
	readonly id: string;
	readonly name: string;
}

/** A tenant location parsed through the shared contract (active, unless overridden). */
export function locationFixture(store: StoreRef, status: LocationStatus = "ACTIVE"): LocationResponse {
	return LocationResponseSchema.parse({
		id: store.id,
		tenantId: TEST_TENANT_ID,
		name: store.name,
		code: store.name.toLowerCase().replaceAll(" ", "-"),
		addressText: null,
		city: null,
		contactPhone: null,
		status,
		rejectionReason: null,
		isPrimary: false,
		createdAt: FIXTURE_NOW,
		updatedAt: FIXTURE_NOW,
	});
}

export interface TenantContextFixture {
	readonly locations: readonly LocationResponse[];
	readonly locationScopeType?: LocationScopeType;
	/** Stores a `SELECTED`-scope member may operate on. */
	readonly locationIds?: readonly string[];
}

/** `GET /t/:tenantSlug/context` for an active member of the test tenant. */
export function tenantContextFixture({ locations, locationScopeType = "ALL_LOCATIONS", locationIds = [] }: TenantContextFixture): TenantContextResponse {
	return TenantContextResponseSchema.parse({
		tenant: {
			id: TEST_TENANT_ID,
			slug: TEST_ORG_SLUG,
			displayName: "Acme Coffee",
			lifecycleState: "ACTIVE",
			primaryLocationId: null,
			createdAt: FIXTURE_NOW,
			updatedAt: FIXTURE_NOW,
			timeZone: "Asia/Kuala_Lumpur",
			logo: null,
		},
		membership: {
			id: "1a2b3c4d-1111-4222-8333-444455556666",
			tenantId: TEST_TENANT_ID,
			userId: "2b3c4d5e-2222-4333-8444-555566667777",
			role: "OWNER",
			status: "ACTIVE",
			displayName: null,
			locationScopeType,
			locationIds: [...locationIds],
			createdAt: FIXTURE_NOW,
			updatedAt: FIXTURE_NOW,
		},
		locations: [...locations],
		merchantProfile: null,
	});
}

export interface ContextQueryState {
	readonly data: Envelope<TenantContextResponse> | undefined;
	readonly isLoading: boolean;
}

/** What a mocked `api.tenants.context.useQuery` returns: loaded with `context`, or still loading. */
export function contextQueryState(context: TenantContextResponse | undefined): ContextQueryState {
	return context === undefined ? { data: undefined, isLoading: true } : { data: testEnvelope(context), isLoading: false };
}

/** Two active stores for location-filter tests (the same ids as the terminal fixtures). */
export const STORE_A_LOCATION: LocationResponse = locationFixture(STORE_A);
export const STORE_B_LOCATION: LocationResponse = locationFixture(STORE_B);

/** An all-locations member of a tenant with stores A and B. */
export const TWO_STORE_CONTEXT: TenantContextResponse = tenantContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION] });

/** The tenant layout's seed for a two-store member whose cookie holds `selectedLocationId`. */
export function twoStoreSeed(selectedLocationId: string | null): TenantContextSeed {
	return { initialLocationId: selectedLocationId, initialTenantContext: testEnvelope(TWO_STORE_CONTEXT) };
}
