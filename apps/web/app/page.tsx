import { LandingCallToAction } from "@/components/landing/landing-call-to-action";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingMerchants } from "@/components/landing/landing-merchants";
import { LandingShell } from "@/components/landing/landing-shell";
import { RewardHubBrowseView } from "@/components/rewardhub/browse/view";
import { hasServerSession } from "@/lib/auth/server";
import { loginPath, ROUTE_PREFIXES, ROUTES } from "@/lib/routes";
import { selectFeaturedOffers, selectMerchantNames, type FeaturedOffer } from "@/lib/rewards/featured-offers";
import { REWARDS_BROWSE_URL_STATE, toRewardsBrowseListQuery } from "@/lib/url-state/rewards-browse";
import { createWebServerCaller } from "@/lib/web-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { ApiPaginatedMetaSchema, nowEpochMs, type Envelope, type RewardResponse } from "@workspace/shared";
import * as React from "react";

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

/** The unfiltered first catalog page — what the hero's featured offers and live count describe. */
const DEFAULT_CATALOG_STATE_KEY: string = REWARDS_BROWSE_URL_STATE.serialize(REWARDS_BROWSE_URL_STATE.defaults);

/** Live offers in the whole catalog, or `undefined` when the request failed. */
function readLiveOfferCount(result: PromiseSettledResult<Envelope<RewardResponse[]>>): number | undefined {
	if (result.status !== "fulfilled") {
		return undefined;
	}
	const meta = ApiPaginatedMetaSchema.safeParse(result.value.meta);
	return meta.success ? meta.data.total : undefined;
}

/**
 * Public landing — browse rewards without signing in; the signed-in app lives under `/rewardhub`.
 * The catalog section's search, filters and page live in the URL (`/?filter[city]=MELAKA#rewards`);
 * the hero always describes the whole catalog, so a filtered URL fetches both pages in parallel.
 */
export default async function LandingPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const server = createWebServerCaller();
	const catalogState = REWARDS_BROWSE_URL_STATE.parse(await searchParams);
	const isSignedIn = await hasServerSession();
	const actions = isSignedIn ? MEMBER_ACTIONS : GUEST_ACTIONS;

	const catalogStateKey: string = REWARDS_BROWSE_URL_STATE.serialize(catalogState);
	const defaultRequest = server.rewards.list.query(toRewardsBrowseListQuery(REWARDS_BROWSE_URL_STATE.defaults));
	const catalogRequest = catalogStateKey === DEFAULT_CATALOG_STATE_KEY ? defaultRequest : server.rewards.list.query(toRewardsBrowseListQuery(catalogState));
	const [defaultResult, catalogResult] = await Promise.allSettled([defaultRequest, catalogRequest]);

	const defaultRewards: readonly RewardResponse[] = defaultResult.status === "fulfilled" ? defaultResult.value.data : [];
	const featuredOffers: readonly FeaturedOffer[] = selectFeaturedOffers(defaultRewards, nowEpochMs());
	const merchantNames: readonly string[] = selectMerchantNames(defaultRewards);

	return (
		<LandingShell>
			<LandingHero featuredOffers={featuredOffers} liveOfferCount={readLiveOfferCount(defaultResult)} secondaryAction={actions.hero} />
			<LandingMerchants merchantNames={merchantNames} />
			{/* The browse view owns the `#rewards` heading; offset it below the sticky header when jumped to. */}
			<section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 [&_#rewards]:scroll-mt-24">
				<RewardHubBrowseView variant="landing" detailPathPrefix={ROUTE_PREFIXES.publicRewards} initialPage={toPrefetchedQuery(catalogStateKey, catalogResult)} />
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
