// The member's own memberships as the shell reads them (`GET /orgs/memberships`): the first page, in the
// order they joined. The server layout prefetches exactly this request and the shell asks for it under the
// same query key, so the prefetch seeds it. The full list is the stores page (`ORG_ROUTES.stores`).

import { LIST_DEFAULT_LIMIT, LIST_FIRST_PAGE } from "@workspace/shared";

/** Stores the switcher lists; with more, it links to the stores page. */
export const SWITCHER_MEMBERSHIPS_PAGE_SIZE = LIST_DEFAULT_LIMIT;

export interface MembershipsPageInput {
	readonly page: number;
	readonly limit: number;
}

/** The shell's memberships request: the first page of the switcher's size. */
export const SWITCHER_MEMBERSHIPS_QUERY: MembershipsPageInput = { page: LIST_FIRST_PAGE, limit: SWITCHER_MEMBERSHIPS_PAGE_SIZE };
