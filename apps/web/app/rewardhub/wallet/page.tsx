import { AccessGate } from "@/components/auth/access-gate";
import { MyClaimsPageView } from "@/components/rewardhub/claims/my-claims-page-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, type RewardClaimResponse } from "@workspace/shared";
import * as React from "react";

const CLAIMS_LIMIT = 20;

export const dynamic = "force-dynamic";

/** `/rewardhub/wallet` — the signed-in user's claimed rewards, server-prefetched. */
export default async function RewardHubWalletPage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();

	let initialClaims: readonly RewardClaimResponse[] | undefined;
	let initialListMeta: ReturnType<typeof ApiPaginatedMetaSchema.parse> | undefined;
	try {
		const response = await server.claims.list.query({ page: 1, limit: CLAIMS_LIMIT });
		initialClaims = response.data;
		const metaParsed = ApiPaginatedMetaSchema.safeParse(response.meta);
		if (metaParsed.success) {
			initialListMeta = metaParsed.data;
		}
	} catch {
		initialClaims = undefined;
	}

	return (
		<AccessGate feature="your claimed rewards">
			<MyClaimsPageView initialClaims={initialClaims} initialListMeta={initialListMeta} />
		</AccessGate>
	);
}
