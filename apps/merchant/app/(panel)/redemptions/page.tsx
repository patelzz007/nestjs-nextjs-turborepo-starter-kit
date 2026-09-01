import { MerchantRedemptionsPageView } from "@/components/redemptions/merchant-redemptions-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { MerchantRedemptionListItem } from "@workspace/shared";
import * as React from "react";

const REDEMPTIONS_PAGE = 1;
const REDEMPTIONS_LIMIT = 20;

export const dynamic = "force-dynamic";

/** Merchant redemptions feed — server-prefetched for the initial HTML. */
export default async function RedemptionsPage(): Promise<React.JSX.Element> {
	const { server, merchantHeaders } = await loadMerchantServerContext();

	let initialRows: readonly MerchantRedemptionListItem[] | undefined;
	try {
		const response = await server.merchant.redemptions.query({ page: REDEMPTIONS_PAGE, limit: REDEMPTIONS_LIMIT }, { headers: merchantHeaders });
		initialRows = response.data;
	} catch {
		initialRows = undefined;
	}

	return <MerchantRedemptionsPageView initialRows={initialRows} />;
}
