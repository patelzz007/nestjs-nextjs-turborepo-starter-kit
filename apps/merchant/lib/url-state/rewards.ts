// Which status tab the rewards catalog shows is a view choice on the page:
// shareable, refresh-safe and undone by Back, so it lives in the URL (ADR 023,
// docs/technical/api/list-queries.md §7). It filters the catalog the page has
// already loaded — the rewards request does not change with it.

import { defineUrlState, optionalUrlParam } from "@workspace/client/lib/url-state/url-state";

import { RewardStatusGroupIdSchema } from "@/lib/rewards/presentation";

/**
 * `/orgs/[orgSlug]/rewards?status=live|review|drafts|ended`. Absent (or not
 * one of those) means "the first tab with rewards" — that depends on the
 * catalog, so it is resolved by `defaultRewardStatusGroupId`, not here.
 */
export const REWARDS_URL_STATE = defineUrlState({ status: optionalUrlParam(RewardStatusGroupIdSchema) });

export type RewardsUrlState = typeof REWARDS_URL_STATE.defaults;
