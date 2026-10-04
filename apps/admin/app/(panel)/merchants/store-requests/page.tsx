import { createAdminServerCaller } from "@/lib/admin-server-api";
import { PENDING_LOCATION_REQUESTS_QUERY } from "@/lib/merchants/location-requests";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import LocationRequestsPanel from "./location-requests-panel";

export const dynamic = "force-dynamic";

/** `/merchants/store-requests` — review pending merchant store location requests. A failed prefetch is logged and left to the client query. */
export default async function MerchantStoreRequestsPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/merchants/store-requests", resource: "pending store requests" }, () =>
		server.rewardsAdmin.listLocationRequests.query(PENDING_LOCATION_REQUESTS_QUERY),
	);

	return <LocationRequestsPanel initialPendingRequests={resolvePrefetchedData(result)} />;
}
