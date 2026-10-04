// The redemption log's page lives in the URL (ADR 023, docs/technical/api/list-queries.md §7):
// `?page=2` is shareable, survives a reload and Back returns to the previous
// page. The STORE is not URL state — it is the member's choice, owned by the
// tenant-context feature store (+ its cookie), and joins the request as the
// `locationId` scope.

import { listStateToListQuery, type TableFilterState, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { merchantRedemptionListQuery } from "@workspace/shared";

import { MERCHANT_REDEMPTIONS_PAGE_SIZE } from "@/lib/redemptions/redemptions-page";
import type { DayWindow } from "@/lib/redemptions/today-window";

/** The log offers one page size; `?limit=` with any other value falls back to it. */
const REDEMPTIONS_PAGE_SIZES: readonly number[] = [MERCHANT_REDEMPTIONS_PAGE_SIZE];

/**
 * `/orgs/[orgSlug]/redemptions?page=&cursor=&sort=` — the list keys of
 * `GET /orgs/:orgSlug/redemptions`, so the URL maps 1:1 onto the request.
 */
export const REDEMPTIONS_URL_STATE = defineUrlState({
	...listUrlParams(merchantRedemptionListQuery, { pageSizes: REDEMPTIONS_PAGE_SIZES, defaultLimit: MERCHANT_REDEMPTIONS_PAGE_SIZE }),
});

export type RedemptionsUrlState = typeof REDEMPTIONS_URL_STATE.defaults;

/** The redemptions request: the URL's list keys (the log has no filters), the organization, and the store scope. */
export type RedemptionsQueryInput = Pick<TableListQueryInput<TableFilterState>, "page" | "limit" | "cursor" | "sort"> & {
	readonly orgSlug: string;
	/** The tenant-context store filter (`undefined` = every store the member may see). */
	readonly locationId: string | undefined;
};

/**
 * The `GET /orgs/:orgSlug/redemptions` input for a URL state and store scope —
 * built by the server page (prefetch) and the view (query) from the same
 * inputs, so the prefetched page lands under the client's query key.
 */
export function toRedemptionsQuery(orgSlug: string, locationId: string | undefined, state: RedemptionsUrlState): RedemptionsQueryInput {
	const { page, limit, cursor, sort } = listStateToListQuery(merchantRedemptionListQuery, { pagination: state, sort: state.sort });
	return { orgSlug, page, limit, ...(cursor !== undefined ? { cursor } : {}), ...(sort !== undefined ? { sort } : {}), locationId };
}

/** A count request needs only `meta.total`; one row is the smallest page the list grammar accepts. */
export const REDEMPTIONS_COUNT_PAGE_SIZE = 1;

/** The "redeemed today" count request: the redemptions of `day` in the store scope — the API's `meta.total` is the count. */
export interface RedemptionsDayCountQueryInput {
	readonly orgSlug: string;
	readonly page: number;
	readonly limit: number;
	readonly locationId: string | undefined;
	readonly filter: { readonly redeemedAt: { readonly gte: number; readonly lt: number } };
}

export function toRedemptionsDayCountQuery(orgSlug: string, locationId: string | undefined, day: DayWindow): RedemptionsDayCountQueryInput {
	return { orgSlug, page: 1, limit: REDEMPTIONS_COUNT_PAGE_SIZE, locationId, filter: { redeemedAt: { gte: day.fromMs, lt: day.toMs } } };
}
