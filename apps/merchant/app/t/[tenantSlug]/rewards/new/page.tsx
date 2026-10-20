import { MerchantCreateRewardPageView } from "@/contexts/rewards/components/merchant-create-reward-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import type { RewardCategory } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantCreateRewardPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

function resolveDefaultCategory(): RewardCategory {
	return "cafe";
}

export default async function MerchantCreateRewardPage({ params }: MerchantCreateRewardPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/rewards/new");
	if (denied !== null) {
		return denied;
	}

	return <MerchantCreateRewardPageView tenantSlug={tenantSlug} defaultCategory={resolveDefaultCategory()} />;
}
