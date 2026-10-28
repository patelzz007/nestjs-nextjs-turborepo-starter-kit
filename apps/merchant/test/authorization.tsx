import { MerchantAuthorizationStateProvider } from "@/contexts/tenancy/components/access/merchant-authorization-provider";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import { merchantCapabilitiesOf, TENANT_ROLE_TEMPLATES } from "@workspace/shared";
import type { Envelope, TenantContextResponse, MembershipRole, MerchantCapability, TenantRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

export const TEST_ORG_SLUG = "acme-coffee";

/** A cashier the owner granted `analytics.read` (ADR 067, edge case 5): the template's capabilities plus analytics. */
export const CASHIER_GRANTED_ANALYTICS: readonly MerchantCapability[] = [...merchantCapabilitiesOf(TENANT_ROLE_TEMPLATES.CASHIER), "merchant:view_analytics"];

/** Minimal active membership fixture for `role`; `capabilities` is the API's answer (role + live grants), else the role's template. */
export function membershipFixture(role: MembershipRole, capabilities?: readonly MerchantCapability[]): TenantRewardMembershipResponse {
	return {
		...(capabilities === undefined ? {} : { capabilities: [...capabilities] }),
		tenantId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		tenantSlug: TEST_ORG_SLUG,
		displayName: "Acme Coffee",
		role,
		kybStatus: "APPROVED",
		lifecycleState: "ACTIVE",
	};
}

export interface AuthorizationFixture {
	/** Active membership role; `undefined` means no membership (every check denies). */
	readonly role?: MembershipRole | undefined;
	/** What the member holds right now (ADR 067: role + live grants); omitted = the role's template. */
	readonly capabilities?: readonly MerchantCapability[] | undefined;
	readonly isLoading?: boolean;
	/** Server seed of the tenant context (store filter + tenant context), as the tenant layout passes it. */
	readonly tenantContext?: TenantContextSeed;
}

export interface TenantContextSeed {
	readonly initialLocationId: string | null;
	readonly initialTenantContext?: Envelope<TenantContextResponse> | undefined;
}

const NO_TENANT_CONTEXT_SEED: TenantContextSeed = { initialLocationId: null };

/**
 * Wraps `ui` like the app root and the tenant shell do: the UI kit's English
 * labels and the URL-state engine (`ClientTestProviders`), the merchant authorization providers with
 * the capabilities the role maps to, and the tenant context for `TEST_ORG_SLUG`
 * (location-aware views also need `api.tenants.context.useQuery` mocked —
 * see `test/tenant-context.ts`) inside a fresh TanStack Query client (for views
 * that invalidate the cache). The providers are a `wrapper`, so the result's
 * `rerender(ui)` keeps them (e.g. to re-read the URL after back/forward).
 */
export function renderWithAuthorization(
	ui: React.ReactElement,
	{ role, capabilities, isLoading = false, tenantContext = NO_TENANT_CONTEXT_SEED }: AuthorizationFixture = {},
): RenderResult {
	const membership = role === undefined ? undefined : membershipFixture(role, capabilities);
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	function AuthorizationWrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<ClientTestProviders>
				<QueryClientProvider client={queryClient}>
					<MerchantAuthorizationStateProvider isLoading={isLoading} capabilities={resolveMerchantCapabilities(membership)}>
						<TenantContextProvider tenantSlug={TEST_ORG_SLUG} initialLocationId={tenantContext.initialLocationId} initialTenantContext={tenantContext.initialTenantContext}>
							{children}
						</TenantContextProvider>
					</MerchantAuthorizationStateProvider>
				</QueryClientProvider>
			</ClientTestProviders>
		);
	}
	return render(ui, { wrapper: AuthorizationWrapper });
}
