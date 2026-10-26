import { MerchantEditRewardPageView } from "@/contexts/rewards/components/merchant-edit-reward-page-view";
import { loadTenantServerCaller } from "@/contexts/tenancy/lib/tenant/tenant-server-caller";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantEditRewardPageProps {
	readonly params: Promise<{ tenantSlug: string; rewardId: string }>;
}

export default async function MerchantEditRewardPage({ params }: MerchantEditRewardPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, rewardId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/rewards/[rewardId]/edit");
	if (denied !== null) {
		return denied;
	}
	const server = await loadTenantServerCaller(tenantSlug);

	// An access answer leaves the data to the client query; an outage is logged and rethrown to `error.tsx`.
	const [result] = await Promise.allSettled([server.tenants.rewards.get.query({ tenantSlug, rewardId })]);
	const initialReward = prefetchedDataOrUndefined(result, "tenants.rewards.get");

	return <MerchantEditRewardPageView tenantSlug={tenantSlug} rewardId={rewardId} initialReward={initialReward} />;
}
