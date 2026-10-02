import { LandingCallToAction } from "@/components/landing/landing-call-to-action";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingMerchants } from "@/components/landing/landing-merchants";
import { LandingShell } from "@/components/landing/landing-shell";
import { RewardHubBrowseView } from "@/components/rewardhub/browse/view";
import { hasServerSession } from "@/lib/auth/server";
import { loginPath, ROUTE_PREFIXES, ROUTES } from "@/lib/routes";
import { selectFeaturedOffers, selectMerchantNames, type FeaturedOffer } from "@/lib/rewards/featured-offers";
import { readPaginatedHasNext } from "@workspace/client/lib/api/envelope";
import { createWebServerCaller } from "@/lib/web-server-api";
import { ApiPaginatedMetaSchema, nowEpochMs, type RewardResponse } from "@workspace/shared";
import * as React from "react";

const REWARDS_LIMIT = 12;

interface LandingAction {
	readonly label: string;
	readonly href: string;
}

interface LandingActions {
	readonly hero: LandingAction;
	readonly cta: LandingAction;
}

/** Where the landing sends a visitor next — sign-in for guests, the signed-in app / wallet once signed in. */
const GUEST_ACTIONS: LandingActions = {
	hero: { label: "Sign in to claim", href: loginPath(ROUTES.rewardHub.browse) },
	cta: { label: "Sign in or create account", href: loginPath(ROUTES.rewardHub.browse) },
};
const MEMBER_ACTIONS: LandingActions = {
	hero: { label: "Go to dashboard", href: ROUTES.rewardHub.browse },
	cta: { label: "Open my wallet", href: ROUTES.rewardHub.wallet },
};

export const dynamic = "force-dynamic";

/** Public landing — browse rewards without signing in; the signed-in app lives under `/rewardhub`. */
export default async function LandingPage(): Promise<React.JSX.Element> {
	const server = createWebServerCaller();
	const isSignedIn = await hasServerSession();
	const actions = isSignedIn ? MEMBER_ACTIONS : GUEST_ACTIONS;

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

	const featuredOffers: readonly FeaturedOffer[] = initialRewards === undefined ? [] : selectFeaturedOffers(initialRewards, nowEpochMs());
	const merchantNames: readonly string[] = initialRewards === undefined ? [] : selectMerchantNames(initialRewards);

	return (
		<LandingShell>
			<LandingHero featuredOffers={featuredOffers} liveOfferCount={initialListMeta?.total} secondaryAction={actions.hero} />
			<LandingMerchants merchantNames={merchantNames} />
			{/* The browse view owns the `#rewards` heading; offset it below the sticky header when jumped to. */}
			<section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 [&_#rewards]:scroll-mt-24">
				<RewardHubBrowseView
					variant="landing"
					detailPathPrefix={ROUTE_PREFIXES.publicRewards}
					initialRewards={initialRewards}
					initialHasNext={initialHasNext}
					initialListMeta={initialListMeta}
				/>
			</section>
			<LandingHowItWorks />
			<LandingCallToAction
				heading={isSignedIn ? "Your rewards are waiting" : "Ready to claim your first reward?"}
				description={
					isSignedIn
						? "Check what's in your wallet, what expires soon, and redeem at the counter."
						: "A free account takes a minute. Claim an offer, then show the QR code in store."
				}
				action={actions.cta}
			/>
		</LandingShell>
	);
}
