import type { AdminMerchantListQuery } from "@workspace/shared";

/** The first page of the KYB review queue. */
const FIRST_PAGE = 1;

/** How many pending merchants the KYB review queue shows. */
const PENDING_KYB_QUEUE_PAGE_SIZE = 50;

/**
 * The pending KYB review queue query — one value shared by the server
 * prefetch (`/merchants/verification` page) and the client query, so the
 * prefetched envelope lands under exactly the key the client reads.
 */
export const PENDING_KYB_MERCHANTS_QUERY: AdminMerchantListQuery = {
	page: FIRST_PAGE,
	limit: PENDING_KYB_QUEUE_PAGE_SIZE,
	filter: { kybStatus: { eq: "PENDING" } },
};
