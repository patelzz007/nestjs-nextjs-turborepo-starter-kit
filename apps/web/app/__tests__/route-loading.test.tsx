// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, it, vi } from "vitest";

import LandingLoading from "@/app/(landing)/loading";
import WebLoginLoading from "@/app/auth/login/loading";
import HelloLoading from "@/app/hello/loading";
import RewardHubAccountLoading from "@/app/rewardhub/account/loading";
import RewardHubActivityLoading from "@/app/rewardhub/activity/loading";
import RewardHubBrowseLoading from "@/app/rewardhub/loading";
import RewardHubReferralsLoading from "@/app/rewardhub/referrals/loading";
import RewardHubRewardDetailLoading from "@/app/rewardhub/rewards/[rewardId]/loading";
import WalletClaimLoading from "@/app/rewardhub/wallet/[claimId]/loading";
import RewardHubWalletLoading from "@/app/rewardhub/wallet/loading";
import PublicRewardDetailLoading from "@/app/rewards/[rewardId]/loading";
import {
	ACCOUNT_SETTINGS_LOADING_LABELS,
	ACTIVITY_LOADING_LABELS,
	CLAIM_QR_LOADING_LABELS,
	LANDING_LOADING_LABELS,
	PROFILE_LOADING_LABELS,
	REFERRALS_LOADING_LABELS,
	REWARD_DETAIL_LOADING_LABELS,
	REWARDS_CATALOG_LOADING_LABELS,
	SIGN_IN_LOADING_LABELS,
	WALLET_LOADING_LABELS,
} from "@/components/loading/loading-labels";
import { expectSingleLoadingStatus, SkeletonTestProviders } from "@/test-support/skeleton";

// The public chrome reads the session for its sign-in actions; it is not what these cases check.
vi.mock("@/components/landing/landing-shell", () => ({
	LandingShell: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</>,
}));

interface RouteLoadingCase {
	readonly route: string;
	/** The route's `loading.tsx` default export. */
	readonly loadingView: () => React.JSX.Element;
	readonly announcement: string | undefined;
}

const ROUTE_LOADING_CASES: readonly RouteLoadingCase[] = [
	{ route: "/", loadingView: LandingLoading, announcement: LANDING_LOADING_LABELS.loading },
	{ route: "/auth/login", loadingView: WebLoginLoading, announcement: SIGN_IN_LOADING_LABELS.loading },
	{ route: "/hello", loadingView: HelloLoading, announcement: PROFILE_LOADING_LABELS.loading },
	{ route: "/rewardhub", loadingView: RewardHubBrowseLoading, announcement: REWARDS_CATALOG_LOADING_LABELS.loading },
	{ route: "/rewardhub/account", loadingView: RewardHubAccountLoading, announcement: ACCOUNT_SETTINGS_LOADING_LABELS.loading },
	{ route: "/rewardhub/activity", loadingView: RewardHubActivityLoading, announcement: ACTIVITY_LOADING_LABELS.loading },
	{ route: "/rewardhub/referrals", loadingView: RewardHubReferralsLoading, announcement: REFERRALS_LOADING_LABELS.loading },
	{ route: "/rewardhub/rewards/[rewardId]", loadingView: RewardHubRewardDetailLoading, announcement: REWARD_DETAIL_LOADING_LABELS.loading },
	{ route: "/rewardhub/wallet", loadingView: RewardHubWalletLoading, announcement: WALLET_LOADING_LABELS.loading },
	{ route: "/rewardhub/wallet/[claimId]", loadingView: WalletClaimLoading, announcement: CLAIM_QR_LOADING_LABELS.loading },
	{ route: "/rewards/[rewardId]", loadingView: PublicRewardDetailLoading, announcement: REWARD_DETAIL_LOADING_LABELS.loading },
];

afterEach((): void => {
	cleanup();
});

describe("route loading states", () => {
	it.each(ROUTE_LOADING_CASES)("$route shows one busy skeleton announcing what loads", ({ loadingView, announcement }: RouteLoadingCase) => {
		render(React.createElement(loadingView), { wrapper: SkeletonTestProviders });

		expectSingleLoadingStatus(announcement);
	});
});
