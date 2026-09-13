"use client";

import { useMerchantOrg } from "@/lib/session/root-provider";
import { stubApiMeta } from "@/lib/api-envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { resolveActiveOrganizationMembership, resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import { hasCapability, type CapabilitySlug, type OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: OrganizationRewardMembershipResponse | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly hasCapability: (capability: CapabilitySlug) => boolean;
	readonly isLoading: boolean;
	readonly isPolicyReady: boolean;
}

/** Client hook — capabilities derived from organization membership role (Cedar-backed on API). */
export function useMerchantCapabilities(initialMemberships?: readonly OrganizationRewardMembershipResponse[]): MerchantCapabilitiesState {
	const { api } = useAuth();
	const { organizationSlug } = useMerchantOrg();

	const initialMeData = React.useMemo(
		() =>
			initialMemberships !== undefined && initialMemberships.length > 0
				? {
						success: true as const,
						data: [...initialMemberships],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialMemberships],
	);

	const membershipsQuery = api.organizations.membershipsBootstrap.useQuery(
		{},
		{
			initialData: initialMeData,
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const membership = React.useMemo(
		(): OrganizationRewardMembershipResponse | undefined => resolveActiveOrganizationMembership(membershipsQuery.data?.data ?? [], organizationSlug),
		[membershipsQuery.data?.data, organizationSlug],
	);

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveMerchantCapabilities(membership), [membership]);

	const checkCapability = React.useCallback((capability: CapabilitySlug): boolean => hasCapability(capabilities, capability), [capabilities]);

	const isLoading = membershipsQuery.isPending;
	const isPolicyReady = membership !== undefined;

	return {
		membership,
		capabilities,
		hasCapability: checkCapability,
		isLoading,
		isPolicyReady,
	};
}
