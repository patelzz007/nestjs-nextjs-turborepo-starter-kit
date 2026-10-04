// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearAllOrganizationLocationCookies, organizationLocationCookieName } from "@/lib/org/location";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { contextQueryState, STORE_A_LOCATION, STORE_B_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import { MerchantErrorCodes, type Envelope, type OrganizationContextResponse } from "@workspace/shared";

import {
	TenantContextProvider,
	useActiveLocationFilter,
	useActiveLocationId,
	useMerchantLocation,
	useTenantContextCommands,
	type MerchantLocationState,
	type TenantContextCommands,
	type TenantContextProviderProps,
} from "./facade";

interface ContextQueryInput {
	readonly orgSlug: string;
}

interface ContextQueryOptions {
	readonly initialData?: Envelope<OrganizationContextResponse>;
}

const { contextQuery } = vi.hoisted(() => ({
	contextQuery: vi.fn<(input: ContextQueryInput, options?: ContextQueryOptions) => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { organizations: { context: { useQuery: contextQuery } } } }),
}));

const OTHER_ORG_SLUG = "bean-there";
const REMOVED_STORE_ID = "0f0f0f0f-0000-4000-8000-0000000000ff";

type ProviderInputs = Omit<TenantContextProviderProps, "children">;

/** Props the wrapper renders the provider with — change them, then `rerender()`. */
let providerInputs: ProviderInputs = { orgSlug: TEST_ORG_SLUG, initialLocationId: null };
/** A fresh cache per test — the provider subscribes to it for the API's location refusals. */
let queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<TenantContextProvider {...providerInputs}>{children}</TenantContextProvider>
		</QueryClientProvider>
	);
}

/** One of this organization's queries for `locationId` fails the way the API refuses an out-of-scope store. */
async function apiRefusesStore(locationId: string): Promise<void> {
	const key = apiRouter.organizations.redemptions.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: 20, locationId });
	const refusal = new ApiError({ message: "Location is outside your membership scope", error: MerchantErrorCodes.ORGANIZATION_LOCATION_FORBIDDEN, statusCode: 403 });
	await act(async (): Promise<void> => {
		await queryClient.query({ queryKey: key, queryFn: (): Promise<string> => Promise.reject(refusal) }).catch((): void => undefined);
	});
}

interface TenantProbe {
	readonly location: MerchantLocationState;
	readonly filter: { readonly locationId: string | undefined };
	readonly activeLocationId: string | null;
	readonly commands: TenantContextCommands;
}

function useTenantProbe(): TenantProbe {
	return { location: useMerchantLocation(), filter: useActiveLocationFilter(), activeLocationId: useActiveLocationId(), commands: useTenantContextCommands() };
}

function cookieValue(): string | undefined {
	const prefix = `${organizationLocationCookieName(TEST_ORG_SLUG)}=`;
	return document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
}

beforeEach((): void => {
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	providerInputs = { orgSlug: TEST_ORG_SLUG, initialLocationId: null, initialOrganizationContext: testEnvelope(TWO_STORE_CONTEXT) };
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
});

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	clearAllOrganizationLocationCookies();
});

describe("tenant-context facade", () => {
	it("filters by the server-read store on the very first render", () => {
		providerInputs = { ...providerInputs, initialLocationId: STORE_B.id };

		const { result } = renderHook(useTenantProbe, { wrapper });

		expect(result.current.filter).toEqual({ locationId: STORE_B.id });
		expect(result.current.location).toEqual({
			locationId: STORE_B.id,
			activeLocation: STORE_B_LOCATION,
			accessibleLocations: [STORE_A_LOCATION, STORE_B_LOCATION],
			canSelectAllLocations: true,
			hasOrganizationWideAccess: true,
			isLoading: false,
		});
	});

	it("seeds the organization-context query for this organization from the server", () => {
		renderHook(useTenantProbe, { wrapper });

		const [input, options] = contextQuery.mock.calls.at(0) ?? [];
		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG });
		expect(options?.initialData?.data).toEqual(TWO_STORE_CONTEXT);
	});

	it("keeps the stored store provisionally while the locations load", () => {
		providerInputs = { orgSlug: TEST_ORG_SLUG, initialLocationId: STORE_B.id };
		contextQuery.mockReturnValue(contextQueryState(undefined));

		const { result } = renderHook(useTenantProbe, { wrapper });

		expect(result.current.location).toEqual({
			locationId: STORE_B.id,
			activeLocation: undefined,
			accessibleLocations: [],
			canSelectAllLocations: false,
			hasOrganizationWideAccess: false,
			isLoading: true,
		});
	});

	it("falls back to all stores when the stored store is no longer accessible", () => {
		providerInputs = { ...providerInputs, initialLocationId: REMOVED_STORE_ID };

		const { result } = renderHook(useTenantProbe, { wrapper });

		expect(result.current.activeLocationId).toBeNull();
		expect(result.current.filter).toEqual({ locationId: undefined });
	});

	it("mirrors the choice to THIS organization's cookie only", () => {
		const { result } = renderHook(useTenantProbe, { wrapper });

		act(() => {
			result.current.commands.selectLocation(STORE_A.id);
		});

		expect(document.cookie).toContain(`${organizationLocationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
		expect(document.cookie).not.toContain(`${organizationLocationCookieName(OTHER_ORG_SLUG)}=`);
	});

	it("changes the filter through commands and mirrors it to the cookie", () => {
		const { result } = renderHook(useTenantProbe, { wrapper });
		expect(cookieValue()).toBeUndefined();

		act(() => {
			result.current.commands.selectLocation(STORE_A.id);
		});
		expect(result.current.filter).toEqual({ locationId: STORE_A.id });
		expect(result.current.location.activeLocation).toEqual(STORE_A_LOCATION);
		expect(cookieValue()).toBe(STORE_A.id);

		act(() => {
			result.current.commands.selectAllLocations();
		});
		expect(result.current.filter).toEqual({ locationId: undefined });
		expect(cookieValue()).toBeUndefined();
	});

	it("keeps command identities and the filter object stable across renders", () => {
		const { result, rerender } = renderHook(useTenantProbe, { wrapper });
		const first = result.current;

		rerender();

		expect(result.current.commands).toBe(first.commands);
		expect(result.current.filter).toBe(first.filter);
	});

	it("keeps the member's choice when the layout re-renders with a new seed for the same organization", () => {
		const { result, rerender } = renderHook(useTenantProbe, { wrapper });
		act(() => {
			result.current.commands.selectLocation(STORE_A.id);
		});

		providerInputs = { ...providerInputs, initialLocationId: STORE_B.id };
		rerender();

		expect(result.current.activeLocationId).toBe(STORE_A.id);
	});

	it("starts a fresh store, from its own seed, when the organization changes", () => {
		const { result, rerender } = renderHook(useTenantProbe, { wrapper });
		act(() => {
			result.current.commands.selectLocation(STORE_A.id);
		});

		providerInputs = { orgSlug: OTHER_ORG_SLUG, initialLocationId: null };
		contextQuery.mockReturnValue(contextQueryState(undefined));
		rerender();

		expect(result.current.activeLocationId).toBeNull();
		expect(contextQuery).toHaveBeenLastCalledWith({ orgSlug: OTHER_ORG_SLUG }, {});
	});

	it("recovers from a refused (stale) store: resets the choice, rewrites the cookie, re-reads the context — and never picks it again", async () => {
		providerInputs = { ...providerInputs, initialLocationId: STORE_B.id };
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		const { result } = renderHook(useTenantProbe, { wrapper });
		act(() => {
			result.current.commands.selectLocation(STORE_B.id);
		});
		expect(cookieValue()).toBe(STORE_B.id);

		await apiRefusesStore(STORE_B.id);

		expect(result.current.activeLocationId).not.toBe(STORE_B.id);
		expect(result.current.location.accessibleLocations).toEqual([STORE_A_LOCATION]);
		expect(cookieValue()).toBeUndefined();
		expect(invalidate).toHaveBeenCalledWith({ queryKey: apiRouter.organizations.context.scopeKey({ orgSlug: TEST_ORG_SLUG }) });

		// The same refusal again changes nothing — no loop.
		invalidate.mockClear();
		await apiRefusesStore(STORE_B.id);
		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(result.current.activeLocationId).not.toBe(STORE_B.id);
	});

	it("fails loudly outside its provider", () => {
		expect(() => renderHook(useActiveLocationFilter)).toThrow(/Tenant Context store is missing/u);
	});
});
