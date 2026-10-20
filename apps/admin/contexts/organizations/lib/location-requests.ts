import { ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT, type AdminLocationRequestListQuery } from "@workspace/shared";

/** The first page of the location-request queue. */
const FIRST_PAGE = 1;

/**
 * The pending store-request queue query — one value shared by the server
 * prefetch (`/merchants/store-requests` page) and the client query, so the
 * prefetched envelope lands under exactly the key the client reads.
 */
export const PENDING_LOCATION_REQUESTS_QUERY: AdminLocationRequestListQuery = {
	page: FIRST_PAGE,
	limit: ADMIN_LOCATION_REQUEST_DEFAULT_LIMIT,
	filter: { status: { eq: "PENDING_APPROVAL" } },
};
