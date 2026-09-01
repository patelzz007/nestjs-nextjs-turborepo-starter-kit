import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { MerchantApiKeySummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** POS API keys — server-prefetched for owners. */
export default async function ApiKeysPage(): Promise<React.JSX.Element> {
	const { server, memberships, merchantOrgId, merchantHeaders } = await loadMerchantServerContext();

	const membership = memberships.find((row) => row.merchantOrgId === merchantOrgId);
	const isOwner = membership?.role === "OWNER";

	let initialKeys: readonly MerchantApiKeySummary[] | undefined;
	if (isOwner === true) {
		try {
			const response = await server.merchant.apiKeys.list.query({}, { headers: merchantHeaders });
			initialKeys = response.data;
		} catch {
			initialKeys = undefined;
		}
	}

	return <MerchantApiKeysPageView initialIsOwner={isOwner === true} initialKeys={initialKeys} />;
}
