// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AccountSettingsSkeleton } from "@/components/loading/account-settings-skeleton";
import { ActivityPageSkeleton } from "@/components/loading/activity-skeleton";
import { AuthFormSkeleton, AuthStatusLineSkeleton } from "@/components/loading/auth-form-skeleton";
import { ClaimQrSkeleton } from "@/components/loading/claim-qr-skeleton";
import { HelloProfileSkeleton } from "@/components/loading/hello-profile-skeleton";
import { LandingPageSkeleton } from "@/components/loading/landing-page-skeleton";
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
	VERIFY_EMAIL_LOADING_LABELS,
	WALLET_LOADING_LABELS,
} from "@/components/loading/loading-labels";
import { ReferralsPageSkeleton } from "@/components/loading/referrals-skeleton";
import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import { DashboardBrowseSkeleton } from "@/components/loading/dashboard-browse-skeleton";
import { WalletPageSkeleton } from "@/components/loading/wallet-skeleton";
import { CLAIM_QR_SIZE_PX } from "@/contexts/claims/components/claim-qr-layout";
import { CUSTOMER_REFERRAL_KPIS, CUSTOMER_REWARD_KPIS, CUSTOMER_SPENDING_KPIS } from "@/contexts/reporting/lib/customer-analytics";
import { FEATURED_OFFER_LIMIT } from "@/contexts/rewards/lib/featured-offers";
import { WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { countSlots, expectSingleLoadingStatus, SkeletonTestProviders } from "@/test-support/skeleton";

/** What the `ui-preferences` store reads back for a visitor who chose the list layout. */
const LIST_LAYOUT_SNAPSHOT = "list";

function renderSkeleton(node: React.ReactNode): HTMLElement {
	return render(node, { wrapper: SkeletonTestProviders }).container;
}

/** The card count of each KPI row the activity skeleton draws, in page order. */
function kpiRowSizes(container: HTMLElement): readonly number[] {
	return Array.from(container.querySelectorAll('[data-slot="stat-cards-skeleton"]'), (row: Element): number => row.children.length);
}

beforeEach((): void => {
	window.localStorage.clear();
});

afterEach((): void => {
	cleanup();
	window.localStorage.clear();
});

describe("DashboardBrowseSkeleton", () => {
	it("announces the catalog once and draws reward cards for the default grid layout", () => {
		const container = renderSkeleton(<DashboardBrowseSkeleton />);

		expectSingleLoadingStatus(REWARDS_CATALOG_LOADING_LABELS.loading);
		expect(countSlots(container, "reward-card-skeleton")).toBeGreaterThan(0);
		expect(countSlots(container, "reward-list-row-skeleton")).toBe(0);
	});

	it("draws list rows instead when the visitor saved the list layout", () => {
		window.localStorage.setItem(WEB_UI_PREFERENCES_STORAGE_KEY, LIST_LAYOUT_SNAPSHOT);

		const container = renderSkeleton(<DashboardBrowseSkeleton />);

		expect(countSlots(container, "reward-list-row-skeleton")).toBeGreaterThan(0);
		expect(countSlots(container, "reward-card-skeleton")).toBe(0);
	});
});

describe("LandingPageSkeleton", () => {
	it("announces the landing once, with a featured row per offer the hero previews and the catalog below", () => {
		const container = renderSkeleton(<LandingPageSkeleton />);

		expectSingleLoadingStatus(LANDING_LOADING_LABELS.loading);
		expect(countSlots(container, "featured-offer-skeleton")).toBe(FEATURED_OFFER_LIMIT);
		expect(countSlots(container, "reward-card-skeleton")).toBeGreaterThan(0);
	});
});

describe("RewardDetailSkeleton", () => {
	it("announces the reward once", () => {
		renderSkeleton(<RewardDetailSkeleton />);

		expectSingleLoadingStatus(REWARD_DETAIL_LOADING_LABELS.loading);
	});
});

describe("WalletPageSkeleton", () => {
	it("announces the wallet once, with the two account stats and claim rows", () => {
		const container = renderSkeleton(<WalletPageSkeleton />);

		expectSingleLoadingStatus(WALLET_LOADING_LABELS.loading);
		expect(kpiRowSizes(container)).toEqual([2]);
		expect(countSlots(container, "wallet-claim-row-skeleton")).toBeGreaterThan(0);
	});
});

describe("ClaimQrSkeleton", () => {
	it("announces the redemption code once and reserves the QR code's exact square", () => {
		const container = renderSkeleton(<ClaimQrSkeleton />);

		expectSingleLoadingStatus(CLAIM_QR_LOADING_LABELS.loading);
		const square = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]')).find(
			(bone: HTMLElement): boolean => bone.style.width === `${String(CLAIM_QR_SIZE_PX)}px`,
		);
		expect(square?.style.height).toBe(`${String(CLAIM_QR_SIZE_PX)}px`);
	});
});

describe("ReferralsPageSkeleton", () => {
	it("announces referrals once, with the code panel and referee rows", () => {
		const container = renderSkeleton(<ReferralsPageSkeleton />);

		expectSingleLoadingStatus(REFERRALS_LOADING_LABELS.loading);
		expect(countSlots(container, "referee-row-skeleton")).toBeGreaterThan(0);
	});
});

describe("ActivityPageSkeleton", () => {
	it("announces the activity once and draws as many cards per KPI row as the dashboard defines", () => {
		const container = renderSkeleton(<ActivityPageSkeleton />);

		expectSingleLoadingStatus(ACTIVITY_LOADING_LABELS.loading);
		expect(kpiRowSizes(container)).toEqual([CUSTOMER_SPENDING_KPIS.length, CUSTOMER_REWARD_KPIS.length, CUSTOMER_REFERRAL_KPIS.length]);
		expect(countSlots(container, "chart-skeleton")).toBeGreaterThan(0);
	});
});

describe("AccountSettingsSkeleton", () => {
	it("announces the settings once, with the password form and the devices list", () => {
		const container = renderSkeleton(<AccountSettingsSkeleton />);

		expectSingleLoadingStatus(ACCOUNT_SETTINGS_LOADING_LABELS.loading);
		expect(countSlots(container, "form-skeleton")).toBe(1);
		expect(countSlots(container, "list-skeleton")).toBe(1);
	});
});

describe("HelloProfileSkeleton", () => {
	it("announces the profile once", () => {
		renderSkeleton(<HelloProfileSkeleton />);

		expectSingleLoadingStatus(PROFILE_LOADING_LABELS.loading);
	});
});

describe("AuthFormSkeleton", () => {
	it("announces the named form once and draws a form silhouette", () => {
		const container = renderSkeleton(<AuthFormSkeleton fields={2} labels={SIGN_IN_LOADING_LABELS} />);

		expectSingleLoadingStatus(SIGN_IN_LOADING_LABELS.loading);
		expect(countSlots(container, "form-skeleton")).toBe(1);
	});
});

describe("AuthStatusLineSkeleton", () => {
	it("announces the named status once", () => {
		renderSkeleton(<AuthStatusLineSkeleton labels={VERIFY_EMAIL_LOADING_LABELS} />);

		expectSingleLoadingStatus(VERIFY_EMAIL_LOADING_LABELS.loading);
	});
});
