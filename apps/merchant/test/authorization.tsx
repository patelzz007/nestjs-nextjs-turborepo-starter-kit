import { MerchantAuthorizationStateProvider } from "@/components/access/merchant-authorization-provider";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { render, type RenderResult } from "@testing-library/react";
import type { OrganizationMembershipRole, OrganizationRewardMembershipResponse } from "@workspace/shared";
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
}

/** Wraps `ui` in the merchant authorization providers with the capabilities the role maps to. */
export function renderWithAuthorization(ui: React.ReactElement, { role, isLoading = false }: AuthorizationFixture = {}): RenderResult {
	const membership = role === undefined ? undefined : membershipFixture(role);
	return render(
		<MerchantAuthorizationStateProvider isLoading={isLoading} capabilities={resolveMerchantCapabilities(membership)}>
			{ui}
		</MerchantAuthorizationStateProvider>,
	);
}
