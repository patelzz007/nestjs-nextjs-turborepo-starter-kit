import { RewardHubBrowseView } from "@/components/rewardhub/browse/view";
import { REWARDS_BROWSE_URL_STATE, toRewardsBrowseListQuery } from "@/lib/url-state/rewards-browse";
import { createWebServerCaller } from "@/lib/web-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import * as React from "react";

export const dynamic = "force-dynamic";

/**
 * Browse published consumer rewards. The catalog's search, filters and page
 * live in the URL; the server parses them with the same declaration as the
 * catalog and prefetches exactly that page, so a shared or reloaded link
 * renders the requested results in the initial HTML.
 */
export default async function RewardHubBrowsePage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const urlState = REWARDS_BROWSE_URL_STATE.parse(await searchParams);
	const [result] = await Promise.allSettled([createWebServerCaller().rewards.list.query(toRewardsBrowseListQuery(urlState))]);

	return <RewardHubBrowseView initialPage={toPrefetchedQuery(REWARDS_BROWSE_URL_STATE.serialize(urlState), result)} />;
}
