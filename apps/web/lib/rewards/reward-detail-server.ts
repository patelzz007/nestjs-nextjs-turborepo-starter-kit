import "server-only";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { notFound } from "next/navigation";

import { settleServerQuery } from "@/lib/api/server-query-outcome";
import { createWebServerCaller } from "@/lib/web-server-api";

/**
 * The reward a detail page (`/rewards/[rewardId]`, `/rewardhub/rewards/[rewardId]`)
 * renders, as the API's envelope. A malformed id or a reward the API does not serve (404) renders the
 * not-found page; any other failure reaches the route's `error.tsx`.
 * `GET /rewards/:rewardId` is a public endpoint — the API never answers it with
 * 401 or 403 — so those are not expected outcomes here.
 */
export async function loadRewardDetail(rewardId: string): Promise<Envelope<RewardResponse>> {
	// The same schema the API validates the path with.
	const input = apiRouter.rewards.detail.inputSchema.safeParse({ rewardId });
	if (!input.success) {
		notFound();
	}

	const [result] = await Promise.allSettled([createWebServerCaller().rewards.detail.query(input.data)]);
	const reward = settleServerQuery(result, { label: "rewards.detail", expected: ["not-found"] });
	if (reward.kind === "not-found") {
		notFound();
	}
	// The whole envelope: the page seeds the client query with the server's real `meta`.
	return reward.data;
}
