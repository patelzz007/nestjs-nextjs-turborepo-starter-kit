"use client";

import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { resolveUrlOrganizationMembership } from "@/lib/org/resolve-slug";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import type { CapabilitySlug, Envelope, OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: OrganizationRewardMembershipResponse | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly isLoading: boolean;
	readonly isPolicyReady: boolean;
}

/**
 * Client hook — capabilities derived from the role of the membership in the
 * organization the URL names (Cedar-backed on the API). Fails closed: outside
 * org routes, or for an organization the user does not belong to, there is no
 * membership and no capability — another organization's role is never borrowed. Feeds `MerchantAuthorizationProvider`; UI checks
 * go through `useAuthorization().can(MERCHANT_CAPABILITY.x)` / `<Can>`.
 */
export function useMerchantCapabilities(initialMemberships?: Envelope<OrganizationRewardMembershipResponse[]>): MerchantCapabilitiesState {
	const { api } = useAuth();
	const organizationSlug = useOrganizationSlug();

	const membershipsQuery = api.organizations.membershipsBootstrap.useQuery(
		{},
		{
			...initialDataOption(initialMemberships),
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const membership = React.useMemo(
		(): OrganizationRewardMembershipResponse | undefined => resolveUrlOrganizationMembership(membershipsQuery.data?.data ?? [], organizationSlug),
		[membershipsQuery.data?.data, organizationSlug],
	);

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveMerchantCapabilities(membership), [membership]);

	const isLoading = membershipsQuery.isPending;
	const isPolicyReady = membership !== undefined;

	return {
		membership,
		capabilities,
		isLoading,
		isPolicyReady,
	};
}
