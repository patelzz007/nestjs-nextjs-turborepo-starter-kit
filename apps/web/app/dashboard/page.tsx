import { DashboardBrowseView } from "@/contexts/rewards/components/browse/view";
import { REWARDS_BROWSE_URL_STATE, toRewardsBrowseListQuery } from "@/contexts/rewards/url-state/rewards-browse";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { readTierAvailability } from "@/contexts/tiers/lib/server-tier-availability";
import { ROUTES } from "@/lib/routes";
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
export default async function DashboardBrowsePage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.browse);

	const urlState = REWARDS_BROWSE_URL_STATE.parse(await searchParams);
	const server = createWebServerCaller();
	// The catalog's request depends on whether tiers are on (locked rewards are listed then), so this is read first.
	const tierAvailability = await readTierAvailability();
	const [result] = await Promise.allSettled([server.rewards.list.query(toRewardsBrowseListQuery(urlState, tierAvailability?.enabled === true))]);

	return <DashboardBrowseView initialPage={toPrefetchedQuery(REWARDS_BROWSE_URL_STATE.serialize(urlState), result)} tierAvailability={tierAvailability} />;
}
