import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingShell } from "@/components/landing/landing-shell";
import { RewardHubBrowseView } from "@/components/rewardhub/rewardhub-browse-view";
import { readPaginatedHasNext } from "@/lib/api-envelope";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, type RewardResponse } from "@workspace/shared";
import * as React from "react";

const REWARDS_LIMIT = 12;

export const dynamic = "force-dynamic";

/** Public landing — browse rewards without signing in; dashboard lives at `/rewardhub`. */
export default async function LandingPage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();

	let initialRewards: readonly RewardResponse[] | undefined;
	let initialHasNext: boolean | undefined;
	let initialListMeta: ReturnType<typeof ApiPaginatedMetaSchema.parse> | undefined;

	try {
		const response = await server.rewards.list.query({ limit: REWARDS_LIMIT });
		initialRewards = response.data;
		initialHasNext = readPaginatedHasNext(response.meta, false);
		const metaParsed = ApiPaginatedMetaSchema.safeParse(response.meta);
		if (metaParsed.success) {
			initialListMeta = metaParsed.data;
		}
	} catch {
		initialRewards = undefined;
	}

	return (
		<LandingShell>
			<LandingHero />
			<section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
				<RewardHubBrowseView variant="landing" detailPathPrefix="/rewards" initialRewards={initialRewards} initialHasNext={initialHasNext} initialListMeta={initialListMeta} />
			</section>
			<LandingHowItWorks />
		</LandingShell>
	);
}
