// The wallet's page lives in the URL (docs/technical/api/list-queries.md §7, ADR 023), like the
// reward catalog: a reload or a shared link reopens the same page of claims, and
// back/forward walks through the pages.

import { eqFilter, listStateToListQuery, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState } from "@workspace/client/lib/url-state/url-state";
import { RewardClaimStatusSchema, rewardClaimListQuery, type RewardClaimStatus } from "@workspace/shared";

/** Claims per wallet page. Fixed, so it never appears in the URL. The one page size the server page and the wallet view share. */
export const WALLET_CLAIMS_PAGE_SIZE = 20;

/** The wallet offers one page size; `?limit=` with any other value falls back to it. */
const WALLET_CLAIMS_PAGE_SIZES: readonly number[] = [WALLET_CLAIMS_PAGE_SIZE];

/**
 * A count query only reads `meta.total` — the server's count of every matching
 * claim. One row is the smallest page the list endpoint serves.
 */
const COUNT_ONLY_PAGE_SIZE = 1;

/** Claims the holder can still show at checkout. */
export const READY_TO_REDEEM_STATUS: RewardClaimStatus = RewardClaimStatusSchema.enum.PENDING;

/** `/rewardhub/wallet` state: `?page=&cursor=&sort=` — the same keys `GET /claims` takes. */
export const WALLET_CLAIMS_URL_STATE = defineUrlState({
	...listUrlParams(rewardClaimListQuery, { pageSizes: WALLET_CLAIMS_PAGE_SIZES, defaultLimit: WALLET_CLAIMS_PAGE_SIZE }),
});

export type WalletClaimsUrlState = typeof WALLET_CLAIMS_URL_STATE.defaults;

export type WalletClaimsListFilter = Readonly<{
	status: { eq: RewardClaimStatus } | undefined;
}>;

/** The `GET /claims` input for a wallet URL state — built by the server page (prefetch) and the wallet view (query) alike. */
export function toWalletClaimsListQuery(state: WalletClaimsUrlState): TableListQueryInput<WalletClaimsListFilter> {
	return listStateToListQuery(rewardClaimListQuery, {
		pagination: state,
		sort: state.sort,
		filter: { status: undefined },
	});
}

/**
 * The `GET /claims` input whose `meta.total` is the number of claims ready to
 * redeem across the whole account — counted by the server, never summed from
 * the page on screen.
 */
export function toReadyToRedeemCountQuery(): TableListQueryInput<WalletClaimsListFilter> {
	return listStateToListQuery(rewardClaimListQuery, {
		pagination: { page: LIST_FIRST_PAGE, limit: COUNT_ONLY_PAGE_SIZE },
		sort: undefined,
		filter: { status: eqFilter(READY_TO_REDEEM_STATUS) },
	});
}
