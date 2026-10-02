import { createAdminServerCaller } from "@/lib/admin-server-api";

import LocationRequestsPanel from "./location-requests-panel";

export const dynamic = "force-dynamic";

/** `/merchants/store-requests` — review pending merchant store location requests. */
export default async function MerchantStoreRequestsPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const pendingResult = await Promise.allSettled([server.rewardsAdmin.listLocationRequests.query({ page: 1, limit: 50, filter: { status: { eq: "PENDING_APPROVAL" } } })]);
	const pendingRequests = pendingResult[0].status === "fulfilled" ? pendingResult[0].value.data : undefined;

	return <LocationRequestsPanel initialPendingRequests={pendingRequests} />;
}
