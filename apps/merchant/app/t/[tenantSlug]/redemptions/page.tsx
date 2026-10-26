import { MerchantRedemptionsPageView } from "@/contexts/pos/components/redemptions/merchant-redemptions-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadTenantServerCaller } from "@/contexts/tenancy/lib/tenant/tenant-server-caller";
import type { LocationScopedPrefetch } from "@/contexts/tenancy/lib/tenant/location-prefetch";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { loadServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";
import { dayWindowContaining } from "@/contexts/pos/lib/redemptions/today-window";
import { prefetchedDataOrUndefined, rethrowUnexpectedFailure } from "@/lib/server/server-query-outcome";
import { REDEMPTIONS_URL_STATE, toRedemptionsDayCountQuery, toRedemptionsQuery } from "@/contexts/pos/url-state/redemptions";
import { toPrefetchedQuery, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { nowEpochMs, type Envelope, type MerchantRedemptionListItem } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRedemptionsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The redemption log. The page (`?page=`) is URL state: the server parses it
 * with the view's own declaration and prefetches exactly that page for the
 * store the client's first render filters by, so a shared or reloaded link
 * renders the requested page and the client asks for the key the server filled.
 */
export default async function MerchantRedemptionsPage({ params, searchParams }: MerchantRedemptionsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/redemptions");
	if (denied !== null) {
		return denied;
	}
	const server = await loadTenantServerCaller(tenantSlug);
	// The same store filter the client's first render derives, so the data lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(tenantSlug)).effectiveLocationId);
	const urlState = REDEMPTIONS_URL_STATE.parse(await searchParams);

	// "Today" is decided here, once, so the server render and hydration count the same day.
	const today = dayWindowContaining(nowEpochMs());

	const [result, todayResult] = await Promise.allSettled([
		server.tenants.redemptions.query(toRedemptionsQuery(tenantSlug, locationId, urlState)),
		server.tenants.redemptions.query(toRedemptionsDayCountQuery(tenantSlug, locationId, today)),
	]);
	// An access answer leaves the page to the client query; an outage is logged and rethrown to `error.tsx`.
	const prefetchedPage = toPrefetchedQuery(REDEMPTIONS_URL_STATE.serialize(urlState), rethrowUnexpectedFailure(result, "tenants.redemptions"));
	const initialRedemptions: LocationScopedPrefetch<PrefetchedQuery<Envelope<MerchantRedemptionListItem[]>>> | undefined =
		prefetchedPage === undefined ? undefined : { locationId, data: prefetchedPage };

	const todayCount = prefetchedDataOrUndefined(todayResult, "tenants.redemptions (today count)");

	return (
		<MerchantRedemptionsPageView
			tenantSlug={tenantSlug}
			initialRedemptions={initialRedemptions}
			today={today}
			initialTodayCount={todayCount === undefined ? undefined : { locationId, data: todayCount }}
		/>
	);
}
