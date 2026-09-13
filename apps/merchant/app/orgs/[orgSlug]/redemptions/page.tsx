import { MerchantRedemptionsPageView } from "@/components/redemptions/merchant-redemptions-page-view";
import { loadMerchantServerContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import type { MerchantRedemptionListItem } from "@workspace/shared";
import * as React from "react";

const REDEMPTIONS_LIMIT = 25;

export const dynamic = "force-dynamic";

interface MerchantRedemptionsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantRedemptionsPage({ params }: MerchantRedemptionsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const { server } = await loadMerchantServerContext();
	const locationId = await readOrganizationLocationCookie();

	let initialRedemptions: readonly MerchantRedemptionListItem[] | undefined;
	try {
		const response = await server.organizations.redemptions.query({ orgSlug, page: 1, limit: REDEMPTIONS_LIMIT, locationId });
		initialRedemptions = response.data;
	} catch {
		initialRedemptions = undefined;
	}

	return <MerchantRedemptionsPageView orgSlug={orgSlug} initialRedemptions={initialRedemptions} />;
}
