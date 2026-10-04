import { MerchantApiKeysPageView, type ApiKeysPagePrefetch } from "@/components/api-keys/merchant-api-keys-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { API_KEY_COUNT_PAGE_SIZE, toApiKeyListQuery } from "@/lib/api-keys/api-key-summary";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { prefetchedDataOrUndefined, rethrowUnexpectedFailure } from "@/lib/server/server-query-outcome";
import { API_KEYS_URL_STATE } from "@/lib/url-state/api-keys";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantApiKeysPageProps {
	readonly params: Promise<{ orgSlug: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * POS API keys. The status view (`?status=`) is URL state and an API filter:
 * the server prefetches that view plus the two counts the stat cards show
 * (active keys, revoked keys) as the API answered them, in parallel.
 */
export default async function MerchantApiKeysPage({ params, searchParams }: MerchantApiKeysPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/api-keys");
	if (denied !== null) {
		return denied;
	}
	// `guardOrgPage` already denied any role without `merchant:manage_api_keys`.
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the data lands under its query keys.
	const locationId = toLocationQueryInput((await loadServerLocationScope(orgSlug)).effectiveLocationId);
	const urlState = API_KEYS_URL_STATE.parse(await searchParams);

	const [listResult, activeResult, revokedCountResult] = await Promise.allSettled([
		server.organizations.apiKeys.list.query(toApiKeyListQuery(orgSlug, locationId, urlState.status)),
		server.organizations.apiKeys.list.query(toApiKeyListQuery(orgSlug, locationId, "active")),
		server.organizations.apiKeys.list.query(toApiKeyListQuery(orgSlug, locationId, "revoked", API_KEY_COUNT_PAGE_SIZE)),
	]);

	// An access answer leaves a value to the client query; an outage is logged and rethrown to `error.tsx`.
	const prefetch: ApiKeysPagePrefetch = {
		list: toPrefetchedQuery(API_KEYS_URL_STATE.serialize(urlState), rethrowUnexpectedFailure(listResult, "organizations.apiKeys.list")),
		active: prefetchedDataOrUndefined(activeResult, "organizations.apiKeys.list (active)"),
		revokedCount: prefetchedDataOrUndefined(revokedCountResult, "organizations.apiKeys.list (revoked count)"),
	};
	const initialKeys: LocationScopedPrefetch<ApiKeysPagePrefetch> = { locationId, data: prefetch };

	return <MerchantApiKeysPageView orgSlug={orgSlug} initialKeys={initialKeys} />;
}
