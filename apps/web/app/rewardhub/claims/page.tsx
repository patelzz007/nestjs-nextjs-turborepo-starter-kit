import { MyClaimsPageView } from "@/components/rewardhub/my-claims-page-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { RewardClaimResponse } from "@workspace/shared";
import * as React from "react";

const CLAIMS_PAGE = 1;
const CLAIMS_LIMIT = 20;

export const dynamic = "force-dynamic";

/** List of the signed-in user's reward claims — server-prefetched. */
export default async function MyClaimsPage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();

	let initialClaims: readonly RewardClaimResponse[] | undefined;
	try {
		const response = await server.claims.list.query({ page: CLAIMS_PAGE, limit: CLAIMS_LIMIT });
		initialClaims = response.data;
	} catch {
		initialClaims = undefined;
	}

	return <MyClaimsPageView initialClaims={initialClaims} />;
}
