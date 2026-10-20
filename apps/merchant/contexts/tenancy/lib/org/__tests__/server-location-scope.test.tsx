// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TenantContextProvider, useActiveLocationFilter } from "@/features/tenant-context/facade";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadServerLocationScope, type ServerLocationScope } from "@/contexts/tenancy/lib/org/server-location-scope";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, tenantContextFixture, STORE_A_LOCATION, STORE_B_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import { testEnvelope } from "@/test/envelope";
import { TestQueryClientProvider } from "@/test/query-client";
import type { Envelope, TenantContextResponse } from "@workspace/shared";

const { readLocationCookie, loadContext, contextQuery } = vi.hoisted(() => ({
	readLocationCookie: vi.fn<(tenantSlug: string) => Promise<string | null>>(),
	loadContext: vi.fn<(tenantSlug: string) => Promise<Envelope<TenantContextResponse> | undefined>>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@/lib/merchant-server-api", () => ({
	readLocationCookie: readLocationCookie,
	loadTenantContext: loadContext,
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { context: { useQuery: contextQuery } } } }),
}));

const REMOVED_STORE_ID = "0f0f0f0f-0000-4000-8000-0000000000ff";
const SINGLE_STORE_CONTEXT = tenantContextFixture({ locations: [STORE_A_LOCATION] });
const SCOPED_TO_B_CONTEXT = tenantContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION], locationScopeType: "SELECTED", locationIds: [STORE_B.id] });
const SCOPED_TO_BOTH_CONTEXT = tenantContextFixture({
	locations: [STORE_A_LOCATION, STORE_B_LOCATION],
	locationScopeType: "SELECTED",
	locationIds: [STORE_A.id, STORE_B.id],
});

function serverScope(cookie: string | null, context: TenantContextResponse | undefined): Promise<ServerLocationScope> {
	readLocationCookie.mockResolvedValue(cookie);
	loadContext.mockResolvedValue(context === undefined ? undefined : testEnvelope(context));
	return loadServerLocationScope(TEST_ORG_SLUG);
}

/** The filter the client's FIRST render asks for, given what the org layout seeded. */
function clientFirstRenderFilter(scope: ServerLocationScope): string | undefined {
	contextQuery.mockReturnValue(contextQueryState(scope.tenantContext?.data));
	function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<TestQueryClientProvider>
				<TenantContextProvider tenantSlug={TEST_ORG_SLUG} initialLocationId={scope.selectedLocationId} initialTenantContext={scope.tenantContext}>
					{children}
				</TenantContextProvider>
			</TestQueryClientProvider>
		);
	}
	return renderHook(useActiveLocationFilter, { wrapper }).result.current.locationId;
}

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("loadServerLocationScope", () => {
	it("prefetches the stored store while the member can access it", async () => {
		const scope = await serverScope(STORE_B.id, TWO_STORE_CONTEXT);

		expect(scope).toEqual({ selectedLocationId: STORE_B.id, effectiveLocationId: STORE_B.id, tenantContext: testEnvelope(TWO_STORE_CONTEXT) });
		expect(loadContext).toHaveBeenCalledWith(TEST_ORG_SLUG);
	});

	it("reads the store choice of THIS tenant's cookie", async () => {
		await serverScope(STORE_B.id, TWO_STORE_CONTEXT);

		expect(readLocationCookie).toHaveBeenCalledWith(TEST_ORG_SLUG);
	});

	it("drops a stale cookie on the server — neither the prefetch nor the client seed uses it", async () => {
		const scope = await serverScope(REMOVED_STORE_ID, TWO_STORE_CONTEXT);

		expect(scope.selectedLocationId).toBeNull();
		expect(scope.effectiveLocationId).toBeNull();
	});

	it("never resolves a store-limited member to all stores, even with several stores in scope", async () => {
		expect((await serverScope(null, SCOPED_TO_BOTH_CONTEXT)).effectiveLocationId).toBe(STORE_A.id);
	});

	it("prefetches a single-store member's only store even without a cookie", async () => {
		expect((await serverScope(null, SINGLE_STORE_CONTEXT)).effectiveLocationId).toBe(STORE_A.id);
	});

	it("only offers a SELECTED-scope member the stores in their scope", async () => {
		expect((await serverScope(STORE_A.id, SCOPED_TO_B_CONTEXT)).effectiveLocationId).toBe(STORE_B.id);
	});

	it("ignores the cookie when the member has no tenant context (not a member) — client input is never trusted unvalidated", async () => {
		expect(await serverScope(STORE_B.id, undefined)).toEqual({ selectedLocationId: null, effectiveLocationId: null, tenantContext: undefined });
	});
});

describe("server prefetch filter ↔ client first-render filter", () => {
	it.each([
		["a valid stored store", STORE_B.id, TWO_STORE_CONTEXT],
		["no stored store, two stores", null, TWO_STORE_CONTEXT],
		["a stale stored store", REMOVED_STORE_ID, TWO_STORE_CONTEXT],
		["a single-store member without a cookie", null, SINGLE_STORE_CONTEXT],
		["a SELECTED-scope member with an out-of-scope cookie", STORE_A.id, SCOPED_TO_B_CONTEXT],
		["a SELECTED-scope member with two stores and no cookie", null, SCOPED_TO_BOTH_CONTEXT],
		["an unavailable tenant context", STORE_B.id, undefined],
	])("agree for %s, so the prefetched data lands under the client's query key", async (_case: string, cookie: string | null, context: TenantContextResponse | undefined) => {
		const scope = await serverScope(cookie, context);

		expect(clientFirstRenderFilter(scope)).toBe(toLocationQueryInput(scope.effectiveLocationId));
	});
});
