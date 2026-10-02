import { MerchantCreateRewardPageView } from "@/components/rewards/merchant-create-reward-page-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import type { RewardCategory } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantCreateRewardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

function resolveDefaultCategory(): RewardCategory {
	return "cafe";
}

export default async function MerchantCreateRewardPage({ params }: MerchantCreateRewardPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/rewards/new");
	if (denied !== null) {
		return denied;
	}

	return <MerchantCreateRewardPageView orgSlug={orgSlug} defaultCategory={resolveDefaultCategory()} />;
}
