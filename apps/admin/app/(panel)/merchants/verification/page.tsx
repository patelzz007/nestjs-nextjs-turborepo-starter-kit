import { createAdminServerCaller } from "@/lib/admin-server-api";
import { PENDING_KYB_MERCHANTS_QUERY } from "@/lib/merchants/kyb-review";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import KybReviewPanel from "./kyb-review-panel";

export const dynamic = "force-dynamic";

/**
 * `/merchants/verification` — review merchant KYB submissions and update
 * verification status. `?organizationId=` selects a merchant in the side panel
 * (in-page selection on the queue, so it stays in the query string); the
 * panel loads that merchant by id, so it is shown even when it is not in the
 * pending queue. A failed queue prefetch is logged and left to the client.
 */
export default async function MerchantVerificationPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/merchants/verification", resource: "pending KYB queue" }, () =>
		server.rewardsAdmin.listOrganizations.query(PENDING_KYB_MERCHANTS_QUERY),
	);

	return <KybReviewPanel initialPendingMerchants={resolvePrefetchedData(result)} />;
}
