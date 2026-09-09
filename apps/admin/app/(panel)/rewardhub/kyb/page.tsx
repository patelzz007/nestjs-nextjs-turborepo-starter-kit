import { createAdminServerCaller } from "@/lib/admin-server-api";

import KybReviewPanel from "./kyb-review-panel";

export const dynamic = "force-dynamic";

/** `/rewardhub/kyb` — review merchant KYB submissions and update verification status. */
export default async function RewardHubKybPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const params = await searchParams;
	const merchantOrgIdParam = params.merchantOrgId;
	const initialMerchantOrgId = typeof merchantOrgIdParam === "string" ? merchantOrgIdParam : undefined;

	const server = createAdminServerCaller();
	const pendingResult = await Promise.allSettled([server.rewardsAdmin.listMerchants.query({ page: 1, limit: 50, kybStatus: "PENDING" })]);
	const pendingMerchants = pendingResult[0].status === "fulfilled" ? pendingResult[0].value.data : undefined;

	return <KybReviewPanel initialMerchantOrgId={initialMerchantOrgId} initialPendingMerchants={pendingMerchants} />;
}
