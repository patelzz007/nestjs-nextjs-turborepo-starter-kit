import { RewardHubBrowseView } from "@/components/rewardhub/rewardhub-browse-view";
import { readPaginatedHasNext } from "@/lib/api-envelope";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, type RewardResponse } from "@workspace/shared";
import * as React from "react";

const REWARDS_LIMIT = 12;

export const dynamic = "force-dynamic";

/** Browse published consumer rewards — server-prefetched for the initial HTML. */
export default async function RewardHubBrowsePage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();

	let initialRewards: readonly RewardResponse[] | undefined;
	let initialHasNext: boolean | undefined;
	let initialListMeta: ReturnType<typeof ApiPaginatedMetaSchema.parse> | undefined;

	try {
		const response = await server.rewards.list.query({ page: 1, limit: REWARDS_LIMIT });
		initialRewards = response.data;
		initialHasNext = readPaginatedHasNext(response.meta, false);
		const metaParsed = ApiPaginatedMetaSchema.safeParse(response.meta);
		if (metaParsed.success) {
			initialListMeta = metaParsed.data;
		}
	} catch {
		initialRewards = undefined;
	}

	return <RewardHubBrowseView initialRewards={initialRewards} initialHasNext={initialHasNext} initialListMeta={initialListMeta} />;
}
