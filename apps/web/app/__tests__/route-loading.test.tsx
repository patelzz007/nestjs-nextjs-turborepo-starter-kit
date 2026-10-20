// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, it, vi } from "vitest";

import LandingLoading from "@/app/(landing)/loading";
import WebLoginLoading from "@/app/auth/login/loading";
import HelloLoading from "@/app/hello/loading";
import DashboardAccountLoading from "@/app/dashboard/account/loading";
import DashboardActivityLoading from "@/app/dashboard/activity/loading";
import DashboardBrowseLoading from "@/app/dashboard/loading";
import DashboardReferralsLoading from "@/app/dashboard/referrals/loading";
import DashboardRewardDetailLoading from "@/app/dashboard/rewards/[rewardId]/loading";
import WalletClaimLoading from "@/app/dashboard/wallet/[claimId]/loading";
import DashboardWalletLoading from "@/app/dashboard/wallet/loading";
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
	{ route: "/dashboard", loadingView: DashboardBrowseLoading, announcement: REWARDS_CATALOG_LOADING_LABELS.loading },
	{ route: "/dashboard/account", loadingView: DashboardAccountLoading, announcement: ACCOUNT_SETTINGS_LOADING_LABELS.loading },
	{ route: "/dashboard/activity", loadingView: DashboardActivityLoading, announcement: ACTIVITY_LOADING_LABELS.loading },
	{ route: "/dashboard/referrals", loadingView: DashboardReferralsLoading, announcement: REFERRALS_LOADING_LABELS.loading },
	{ route: "/dashboard/rewards/[rewardId]", loadingView: DashboardRewardDetailLoading, announcement: REWARD_DETAIL_LOADING_LABELS.loading },
	{ route: "/dashboard/wallet", loadingView: DashboardWalletLoading, announcement: WALLET_LOADING_LABELS.loading },
	{ route: "/dashboard/wallet/[claimId]", loadingView: WalletClaimLoading, announcement: CLAIM_QR_LOADING_LABELS.loading },
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
