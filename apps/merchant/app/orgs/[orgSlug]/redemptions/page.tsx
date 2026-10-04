import { MerchantRedemptionsPageView } from "@/components/redemptions/merchant-redemptions-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { dayWindowContaining } from "@/lib/redemptions/today-window";
import { prefetchedDataOrUndefined, rethrowUnexpectedFailure } from "@/lib/server/server-query-outcome";
import { REDEMPTIONS_URL_STATE, toRedemptionsDayCountQuery, toRedemptionsQuery } from "@/lib/url-state/redemptions";
import { toPrefetchedQuery, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { nowEpochMs, type Envelope, type MerchantRedemptionListItem } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRedemptionsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The redemption log. The page (`?page=`) is URL state: the server parses it
 * with the view's own declaration and prefetches exactly that page for the
 * store the client's first render filters by, so a shared or reloaded link
 * renders the requested page and the client asks for the key the server filled.
 */
export default async function MerchantRedemptionsPage({ params, searchParams }: MerchantRedemptionsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/redemptions");
	if (denied !== null) {
		return denied;
	}
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the data lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(orgSlug)).effectiveLocationId);
	const urlState = REDEMPTIONS_URL_STATE.parse(await searchParams);

	// "Today" is decided here, once, so the server render and hydration count the same day.
	const today = dayWindowContaining(nowEpochMs());

	const [result, todayResult] = await Promise.allSettled([
		server.organizations.redemptions.query(toRedemptionsQuery(orgSlug, locationId, urlState)),
		server.organizations.redemptions.query(toRedemptionsDayCountQuery(orgSlug, locationId, today)),
	]);
	// An access answer leaves the page to the client query; an outage is logged and rethrown to `error.tsx`.
	const prefetchedPage = toPrefetchedQuery(REDEMPTIONS_URL_STATE.serialize(urlState), rethrowUnexpectedFailure(result, "organizations.redemptions"));
	const initialRedemptions: LocationScopedPrefetch<PrefetchedQuery<Envelope<MerchantRedemptionListItem[]>>> | undefined =
		prefetchedPage === undefined ? undefined : { locationId, data: prefetchedPage };

	const todayCount = prefetchedDataOrUndefined(todayResult, "organizations.redemptions (today count)");

	return (
		<MerchantRedemptionsPageView
			orgSlug={orgSlug}
			initialRedemptions={initialRedemptions}
			today={today}
			initialTodayCount={todayCount === undefined ? undefined : { locationId, data: todayCount }}
		/>
	);
}
