import { RewardHubBrowseView } from "@/components/rewardhub/rewardhub-browse-view";
import { readPaginatedTotal } from "@/lib/api-envelope";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, type RewardResponse } from "@workspace/shared";
import * as React from "react";

const REWARDS_PAGE = 1;
const REWARDS_LIMIT = 12;

export const dynamic = "force-dynamic";

/** Browse published consumer rewards — server-prefetched for the initial HTML. */
export default async function RewardHubBrowsePage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();

	let initialRewards: readonly RewardResponse[] | undefined;
	let initialTotal: number | undefined;
	let initialHasNext: boolean | undefined;
	let initialHasPrevious: boolean | undefined;
	let initialListMeta: ReturnType<typeof ApiPaginatedMetaSchema.parse> | undefined;

	try {
		const response = await server.rewards.list.query({ page: REWARDS_PAGE, limit: REWARDS_LIMIT });
		initialRewards = response.data;
		initialTotal = readPaginatedTotal(response.meta, response.data.length);
		const metaParsed = ApiPaginatedMetaSchema.safeParse(response.meta);
		if (metaParsed.success) {
			initialListMeta = metaParsed.data;
			initialHasNext = metaParsed.data.hasNext === true;
			initialHasPrevious = metaParsed.data.hasPrevious === true;
		}
	} catch {
		initialRewards = undefined;
	}

	return (
		<RewardHubBrowseView
			initialRewards={initialRewards}
			initialTotal={initialTotal}
			initialHasNext={initialHasNext}
			initialHasPrevious={initialHasPrevious}
			initialListMeta={initialListMeta}
		/>
	);
}
