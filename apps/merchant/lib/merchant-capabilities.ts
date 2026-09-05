"use client";

import { useMerchantOrg } from "@/lib/merchant-root-provider";
import { stubApiMeta } from "@/lib/api-envelope";
import { resolveActiveMerchantMembership, resolveMerchantCapabilities } from "@/lib/merchant-server-capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import { hasCapability, type CapabilitySlug, type MerchantMembershipResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: MerchantMembershipResponse | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly hasCapability: (capability: CapabilitySlug) => boolean;
	readonly isLoading: boolean;
	/** When true, navigation and gates may apply DB-backed capability checks. */
	readonly isPolicyReady: boolean;
}

/** Client hook — capabilities come from `GET /merchant/me` (DB-backed). */
export function useMerchantCapabilities(initialMemberships?: readonly MerchantMembershipResponse[]): MerchantCapabilitiesState {
	const { api } = useAuth();
	const { merchantOrgId } = useMerchantOrg();

	const initialMeData = React.useMemo(
		() =>
			initialMemberships !== undefined
				? {
						success: true as const,
						data: [...initialMemberships],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialMemberships],
	);

	const membershipsQuery = api.merchant.me.useQuery(
		{},
		{
			initialData: initialMeData,
			staleTime: 0,
		},
	);

	const membership = React.useMemo(
		(): MerchantMembershipResponse | undefined => resolveActiveMerchantMembership(membershipsQuery.data?.data ?? [], merchantOrgId),
		[membershipsQuery.data?.data, merchantOrgId],
	);

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveMerchantCapabilities(membership), [membership]);

	const checkCapability = React.useCallback((capability: CapabilitySlug): boolean => hasCapability(capabilities, capability), [capabilities]);

	const isLoading = membershipsQuery.isPending && membershipsQuery.data === undefined;
	const isPolicyReady = membership !== undefined;

	return {
		membership,
		capabilities,
		hasCapability: checkCapability,
		isLoading,
		isPolicyReady,
	};
}
