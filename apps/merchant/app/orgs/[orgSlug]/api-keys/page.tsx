import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { loadMerchantServerContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
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
	const locationId = await readOrganizationLocationCookie();

	let initialKeys: readonly MerchantApiKeySummary[] | undefined;
	try {
		const response = await server.organizations.apiKeys.list.query({ orgSlug, page: 1, limit: MERCHANT_API_KEYS_PAGE_SIZE, locationId });
		initialKeys = response.data;
	} catch {
		initialKeys = undefined;
	}

	return <MerchantApiKeysPageView orgSlug={orgSlug} initialKeys={initialKeys} />;
}
