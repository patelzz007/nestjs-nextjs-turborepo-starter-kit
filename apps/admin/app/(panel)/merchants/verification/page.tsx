import { createAdminServerCaller } from "@/lib/admin-server-api";

import KybReviewPanel from "./kyb-review-panel";

export const dynamic = "force-dynamic";

/**
 * `/merchants/verification` — review merchant KYB submissions and update
 * verification status. `?organizationId=` selects a merchant in the side panel
 * (in-page selection on the queue, so it stays in the query string).
 */
export default async function MerchantVerificationPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const params = await searchParams;
	const organizationIdParam = params.organizationId;
	const initialMerchantOrgId = typeof organizationIdParam === "string" ? organizationIdParam : undefined;

	const server = createAdminServerCaller();
	const pendingResult = await Promise.allSettled([server.rewardsAdmin.listOrganizations.query({ page: 1, limit: 50, filter: { kybStatus: { eq: "PENDING" } } })]);
	const pendingMerchants = pendingResult[0].status === "fulfilled" ? pendingResult[0].value.data : undefined;

	return <KybReviewPanel initialMerchantOrgId={initialMerchantOrgId} initialPendingMerchants={pendingMerchants} />;
}
