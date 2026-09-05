import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { serverHasMerchantCapability } from "@/lib/merchant-server-capabilities";
import type { MerchantApiKeySummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** POS API keys — server-prefetched for owners; cashiers see an in-page access message. */
export default async function ApiKeysPage(): Promise<React.JSX.Element> {
	const { server, memberships, merchantOrgId, merchantHeaders } = await loadMerchantServerContext();

	const canManageApiKeys = serverHasMerchantCapability(memberships, merchantOrgId, "merchant:manage_api_keys");

	let initialKeys: readonly MerchantApiKeySummary[] | undefined;
	if (canManageApiKeys) {
		try {
			const response = await server.merchant.apiKeys.list.query({}, { headers: merchantHeaders });
			initialKeys = response.data;
		} catch {
			initialKeys = undefined;
		}
	}

	return <MerchantApiKeysPageView initialCanManageApiKeys={canManageApiKeys} initialKeys={initialKeys} />;
}
