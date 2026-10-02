import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { MERCHANT_API_KEYS_PAGE_SIZE, type MerchantApiKeySummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantApiKeysPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantApiKeysPage({ params }: MerchantApiKeysPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/api-keys");
	if (denied !== null) {
		return denied;
	}
	// `guardOrgPage` already denied any role without `merchant:manage_api_keys`.
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the list lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(orgSlug)).effectiveLocationId);

	let initialKeys: LocationScopedPrefetch<readonly MerchantApiKeySummary[]> | undefined;
	try {
		const response = await server.organizations.apiKeys.list.query({ orgSlug, page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE, locationId });
		initialKeys = { locationId, data: response.data };
	} catch {
		initialKeys = undefined;
	}

	return <MerchantApiKeysPageView orgSlug={orgSlug} initialKeys={initialKeys} />;
}
