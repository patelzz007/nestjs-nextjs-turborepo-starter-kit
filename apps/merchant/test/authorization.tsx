import { MerchantAuthorizationStateProvider } from "@/components/access/merchant-authorization-provider";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { render, type RenderResult } from "@testing-library/react";
import type { OrganizationContextResponse, OrganizationMembershipRole, OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

export const TEST_ORG_SLUG = "acme-coffee";

/** Minimal active membership fixture for `role`. */
export function membershipFixture(role: OrganizationMembershipRole): OrganizationRewardMembershipResponse {
	return {
		organizationId: "7f5f0f0e-7a53-4f5c-9d0a-0d6a6b8f2c11",
		organizationSlug: TEST_ORG_SLUG,
		displayName: "Acme Coffee",
		role,
		kybStatus: "APPROVED",
		lifecycleState: "ACTIVE",
	};
}

export interface AuthorizationFixture {
	/** Active membership role; `undefined` means no membership (every check denies). */
	readonly role?: OrganizationMembershipRole | undefined;
	readonly isLoading?: boolean;
	/** Server seed of the tenant context (store filter + organization context), as the org layout passes it. */
	readonly tenantContext?: TenantContextSeed;
}

export interface TenantContextSeed {
	readonly initialLocationId: string | null;
	readonly initialOrganizationContext?: OrganizationContextResponse | undefined;
}

const NO_TENANT_CONTEXT_SEED: TenantContextSeed = { initialLocationId: null };

/**
 * Wraps `ui` like the org shell does: the merchant authorization providers with
 * the capabilities the role maps to, and the tenant context for `TEST_ORG_SLUG`
 * (location-aware views also need `api.organizations.context.useQuery` mocked —
 * see `test/tenant-context.ts`). The providers are a `wrapper`, so the result's
 * `rerender(ui)` keeps them (e.g. to re-read the URL after back/forward).
 */
export function renderWithAuthorization(ui: React.ReactElement, { role, isLoading = false, tenantContext = NO_TENANT_CONTEXT_SEED }: AuthorizationFixture = {}): RenderResult {
	const membership = role === undefined ? undefined : membershipFixture(role);
	function AuthorizationWrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<MerchantAuthorizationStateProvider isLoading={isLoading} capabilities={resolveMerchantCapabilities(membership)}>
				<TenantContextProvider
					orgSlug={TEST_ORG_SLUG}
					initialLocationId={tenantContext.initialLocationId}
					initialOrganizationContext={tenantContext.initialOrganizationContext}>
					{children}
				</TenantContextProvider>
			</MerchantAuthorizationStateProvider>
		);
	}
	return render(ui, { wrapper: AuthorizationWrapper });
}
