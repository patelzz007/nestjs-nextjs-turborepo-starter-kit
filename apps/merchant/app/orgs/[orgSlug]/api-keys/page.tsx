import { MerchantApiKeysPageView } from "@/components/api-keys/merchant-api-keys-page-view";
import { loadMerchantServerContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import { serverHasMerchantCapability } from "@/lib/session/server-capabilities";
import { MERCHANT_CAPABILITY, type MerchantApiKeySummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantApiKeysPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantApiKeysPage({ params }: MerchantApiKeysPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const { server, memberships, organizationSlug } = await loadMerchantServerContext();
	const locationId = await readOrganizationLocationCookie();

	// Skip the server prefetch for roles the API would reject; the client view gates the UI.
	const canManageApiKeys = serverHasMerchantCapability(memberships, organizationSlug ?? orgSlug, MERCHANT_CAPABILITY.manageApiKeys);

	let initialKeys: readonly MerchantApiKeySummary[] | undefined;
	if (canManageApiKeys) {
		try {
			const response = await server.organizations.apiKeys.list.query({ orgSlug, locationId });
			initialKeys = response.data;
		} catch {
			initialKeys = undefined;
		}
	}

	return <MerchantApiKeysPageView orgSlug={orgSlug} initialKeys={initialKeys} />;
}
