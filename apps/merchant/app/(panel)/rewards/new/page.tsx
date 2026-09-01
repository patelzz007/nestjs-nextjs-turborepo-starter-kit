import { MerchantCreateRewardPageView } from "@/components/rewards/merchant-create-reward-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { RewardCategorySchema, type RewardCategory } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

function resolveDefaultCategory(memberships: readonly { readonly merchantOrgId: string }[], merchantOrgId: string | undefined): RewardCategory {
	const activeMembership = memberships.find((row) => row.merchantOrgId === merchantOrgId) ?? memberships[0];
	if (activeMembership === undefined) {
		return "cafe";
	}

	const parsed = RewardCategorySchema.safeParse("cafe");
	return parsed.success ? parsed.data : "cafe";
}

/** Create reward — SSR shell with client form and live API mutation. */
export default async function NewRewardPage(): Promise<React.JSX.Element> {
	const { memberships, merchantOrgId } = await loadMerchantServerContext();
	const defaultCategory = resolveDefaultCategory(memberships, merchantOrgId);

	return <MerchantCreateRewardPageView defaultCategory={defaultCategory} />;
}
