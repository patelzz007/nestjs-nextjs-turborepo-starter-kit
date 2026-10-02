import { successEnvelope, stubApiMeta } from "@workspace/client/lib/api/envelope";
import {
	OrganizationContextResponseSchema,
	OrganizationLocationResponseSchema,
	type Envelope,
	type OrganizationContextResponse,
	type OrganizationLocationResponse,
	type OrganizationLocationScopeType,
	type OrganizationLocationStatus,
} from "@workspace/shared";

import { TEST_ORG_SLUG, type TenantContextSeed } from "@/test/authorization";
import { STORE_A, STORE_B } from "@/test/terminals";

/** Fixed clock for tenant-context fixtures (2026-10-01T00:00:00Z). */
const FIXTURE_NOW = 1_790_812_800_000;

export const TEST_ORGANIZATION_ID = "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11";

export interface StoreRef {
	readonly id: string;
	readonly name: string;
}

/** An organization location parsed through the shared contract (active, unless overridden). */
export function locationFixture(store: StoreRef, status: OrganizationLocationStatus = "ACTIVE"): OrganizationLocationResponse {
	return OrganizationLocationResponseSchema.parse({
		id: store.id,
		organizationId: TEST_ORGANIZATION_ID,
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

export interface OrganizationContextFixture {
	readonly locations: readonly OrganizationLocationResponse[];
	readonly locationScopeType?: OrganizationLocationScopeType;
	/** Stores a `SELECTED`-scope member may operate on. */
	readonly locationIds?: readonly string[];
}

/** `GET /orgs/:orgSlug/context` for an active member of the test organization. */
export function organizationContextFixture({ locations, locationScopeType = "ALL_LOCATIONS", locationIds = [] }: OrganizationContextFixture): OrganizationContextResponse {
	return OrganizationContextResponseSchema.parse({
		organization: {
			id: TEST_ORGANIZATION_ID,
			slug: TEST_ORG_SLUG,
			displayName: "Acme Coffee",
			lifecycleState: "ACTIVE",
			primaryLocationId: null,
			createdAt: FIXTURE_NOW,
			updatedAt: FIXTURE_NOW,
		},
		membership: {
			id: "1a2b3c4d-1111-4222-8333-444455556666",
			organizationId: TEST_ORGANIZATION_ID,
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
		policyVersion: 1,
	});
}

export interface ContextQueryState {
	readonly data: Envelope<OrganizationContextResponse> | undefined;
	readonly isLoading: boolean;
}

/** What a mocked `api.organizations.context.useQuery` returns: loaded with `context`, or still loading. */
export function contextQueryState(context: OrganizationContextResponse | undefined): ContextQueryState {
	return context === undefined ? { data: undefined, isLoading: true } : { data: successEnvelope(context, stubApiMeta()), isLoading: false };
}

/** Two active stores for location-filter tests (the same ids as the terminal fixtures). */
export const STORE_A_LOCATION: OrganizationLocationResponse = locationFixture(STORE_A);
export const STORE_B_LOCATION: OrganizationLocationResponse = locationFixture(STORE_B);

/** An all-locations member of an organization with stores A and B. */
export const TWO_STORE_CONTEXT: OrganizationContextResponse = organizationContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION] });

/** The org layout's seed for a two-store member whose cookie holds `selectedLocationId`. */
export function twoStoreSeed(selectedLocationId: string | null): TenantContextSeed {
	return { initialLocationId: selectedLocationId, initialOrganizationContext: TWO_STORE_CONTEXT };
}
