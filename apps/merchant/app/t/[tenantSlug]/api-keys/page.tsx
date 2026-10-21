import { MerchantApiKeysPageView, type ApiKeysPagePrefetch } from "@/contexts/pos/components/api-keys/merchant-api-keys-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { API_KEY_COUNT_PAGE_SIZE, toApiKeyListQuery } from "@/contexts/pos/lib/api-keys/api-key-summary";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/contexts/tenancy/lib/tenant/location-prefetch";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { loadServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";
import { prefetchedDataOrUndefined, rethrowUnexpectedFailure } from "@/lib/server/server-query-outcome";
import { API_KEYS_URL_STATE } from "@/contexts/pos/url-state/api-keys";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantApiKeysPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * POS API keys. The status view (`?status=`) is URL state and an API filter:
 * the server prefetches that view plus the two counts the stat cards show
 * (active keys, revoked keys) as the API answered them, in parallel.
 */
export default async function MerchantApiKeysPage({ params, searchParams }: MerchantApiKeysPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/api-keys");
	if (denied !== null) {
		return denied;
	}
	// `guardTenantPage` already denied any role without `merchant:manage_api_keys`.
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the data lands under its query keys.
	const locationId = toLocationQueryInput((await loadServerLocationScope(tenantSlug)).effectiveLocationId);
	const urlState = API_KEYS_URL_STATE.parse(await searchParams);

	const [listResult, activeResult, revokedCountResult] = await Promise.allSettled([
		server.tenants.apiKeys.list.query(toApiKeyListQuery(tenantSlug, locationId, urlState.status)),
		server.tenants.apiKeys.list.query(toApiKeyListQuery(tenantSlug, locationId, "active")),
		server.tenants.apiKeys.list.query(toApiKeyListQuery(tenantSlug, locationId, "revoked", API_KEY_COUNT_PAGE_SIZE)),
	]);

	// An access answer leaves a value to the client query; an outage is logged and rethrown to `error.tsx`.
	const prefetch: ApiKeysPagePrefetch = {
		list: toPrefetchedQuery(API_KEYS_URL_STATE.serialize(urlState), rethrowUnexpectedFailure(listResult, "tenants.apiKeys.list")),
		active: prefetchedDataOrUndefined(activeResult, "tenants.apiKeys.list (active)"),
		revokedCount: prefetchedDataOrUndefined(revokedCountResult, "tenants.apiKeys.list (revoked count)"),
	};
	const initialKeys: LocationScopedPrefetch<ApiKeysPagePrefetch> = { locationId, data: prefetch };

	return <MerchantApiKeysPageView tenantSlug={tenantSlug} initialKeys={initialKeys} />;
}
