import { MerchantCreateRewardPageView } from "@/components/rewards/merchant-create-reward-page-view";
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

	return <MerchantCreateRewardPageView orgSlug={orgSlug} defaultCategory={resolveDefaultCategory()} />;
}
