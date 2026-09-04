"use client";

import { useMerchantOrg } from "@/lib/merchant-root-provider";
import { resolveActiveMerchantMembership, resolveMerchantCapabilities } from "@/lib/merchant-server-capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import { merchantHasCapability, type MerchantCapability, type MerchantMembershipResponse } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: MerchantMembershipResponse | undefined;
	readonly capabilities: readonly MerchantCapability[];
	readonly hasCapability: (capability: MerchantCapability) => boolean;
	readonly canManageRewards: boolean;
	readonly canManageApiKeys: boolean;
	readonly canViewAnalytics: boolean;
	readonly isLoading: boolean;
}

/** Client hook — capabilities come from `GET /merchant/me` (DB-backed). */
export function useMerchantCapabilities(): MerchantCapabilitiesState {
	const { api } = useAuth();
	const { merchantOrgId } = useMerchantOrg();

	const membershipsQuery = api.merchant.me.useQuery({});

	const membership = React.useMemo(
		(): MerchantMembershipResponse | undefined => resolveActiveMerchantMembership(membershipsQuery.data?.data ?? [], merchantOrgId),
		[membershipsQuery.data?.data, merchantOrgId],
	);

	const capabilities = React.useMemo((): readonly MerchantCapability[] => resolveMerchantCapabilities(membership), [membership]);

	const hasCapability = React.useCallback(
		(capability: MerchantCapability): boolean => merchantHasCapability(capabilities, capability),
		[capabilities],
	);

	return {
		membership,
		capabilities,
		hasCapability,
		canManageRewards: hasCapability("merchant:manage_rewards"),
		canManageApiKeys: hasCapability("merchant:manage_api_keys"),
		canViewAnalytics: hasCapability("merchant:view_analytics"),
		isLoading: membershipsQuery.isLoading,
	};
}
