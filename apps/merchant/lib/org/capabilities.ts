"use client";

import { useOrganizationSlug } from "@/lib/org/use-organization-slug";
import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { resolveActiveOrganizationMembership, resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import type { CapabilitySlug, OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: OrganizationRewardMembershipResponse | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly isLoading: boolean;
	readonly isPolicyReady: boolean;
}

/**
 * Client hook — capabilities derived from the active organization membership
 * role (Cedar-backed on API). Feeds `MerchantAuthorizationProvider`; UI checks
 * go through `useAuthorization().can(MERCHANT_CAPABILITY.x)` / `<Can>`.
 */
export function useMerchantCapabilities(initialMemberships?: readonly OrganizationRewardMembershipResponse[]): MerchantCapabilitiesState {
	const { api } = useAuth();
	const organizationSlug = useOrganizationSlug();

	const initialMeData = React.useMemo(
		() => (initialMemberships !== undefined && initialMemberships.length > 0 ? successEnvelope([...initialMemberships], stubApiMeta()) : undefined),
		[initialMemberships],
	);

	const membershipsQuery = api.organizations.membershipsBootstrap.useQuery(
		{},
		{
			...initialDataOption(initialMeData),
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const membership = React.useMemo(
		(): OrganizationRewardMembershipResponse | undefined => resolveActiveOrganizationMembership(membershipsQuery.data?.data ?? [], organizationSlug),
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
