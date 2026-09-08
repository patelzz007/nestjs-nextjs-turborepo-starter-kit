import { MyClaimsPageView } from "@/components/rewardhub/my-claims-page-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, type RewardClaimResponse } from "@workspace/shared";
import * as React from "react";

const CLAIMS_LIMIT = 20;

export const dynamic = "force-dynamic";

/** List of the signed-in user's reward claims — server-prefetched. */
export default async function MyClaimsPage(): Promise<React.JSX.Element> {
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

	return <MyClaimsPageView initialClaims={initialClaims} initialListMeta={initialListMeta} />;
}
