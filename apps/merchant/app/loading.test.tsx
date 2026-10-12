// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MerchantAuthLoading from "@/app/auth/loading";
import MerchantEntryLoading from "@/app/loading";
import MerchantOnboardingLoading from "@/app/onboarding/loading";
import MerchantAccountLoading from "@/app/orgs/[orgSlug]/account/loading";
import MerchantAnalyticsLoading from "@/app/orgs/[orgSlug]/analytics/loading";
import MerchantApiKeysLoading from "@/app/orgs/[orgSlug]/api-keys/loading";
import MerchantDashboardLoading from "@/app/orgs/[orgSlug]/dashboard/loading";
import MerchantOrganizationLoading from "@/app/orgs/[orgSlug]/loading";
import MerchantRedemptionsLoading from "@/app/orgs/[orgSlug]/redemptions/loading";
import MerchantEditRewardLoading from "@/app/orgs/[orgSlug]/rewards/[rewardId]/edit/loading";
import MerchantRewardsLoading from "@/app/orgs/[orgSlug]/rewards/loading";
import MerchantCreateRewardLoading from "@/app/orgs/[orgSlug]/rewards/new/loading";
import MerchantSettingsLoading from "@/app/orgs/[orgSlug]/settings/loading";
import MerchantLocationsLoading from "@/app/orgs/[orgSlug]/settings/locations/loading";
import MerchantTeamLoading from "@/app/orgs/[orgSlug]/settings/team/loading";
import MerchantVerificationLoading from "@/app/orgs/[orgSlug]/settings/verification/loading";
import MerchantTerminalsLoading from "@/app/orgs/[orgSlug]/terminals/loading";
import MerchantTeamInviteLoading from "@/app/team-invite/loading";
import { MERCHANT_AUTH_LOADING_LABELS } from "@/components/loading/auth-skeletons";
import {
	FLEET_SKELETON_ROWS,
	FLEET_STAT_CARDS,
	LOCATION_SKELETON_CARDS,
	MERCHANT_ACCOUNT_LOADING_LABELS,
	MERCHANT_ANALYTICS_LOADING_LABELS,
	MERCHANT_API_KEYS_LOADING_LABELS,
	MERCHANT_DASHBOARD_LOADING_LABELS,
	MERCHANT_LOCATIONS_LOADING_LABELS,
	MERCHANT_REDEMPTIONS_LOADING_LABELS,
	MERCHANT_REWARD_EDITOR_LOADING_LABELS,
	MERCHANT_REWARD_LOADING_LABELS,
	MERCHANT_REWARDS_LOADING_LABELS,
	MERCHANT_SETTINGS_LOADING_LABELS,
	MERCHANT_TEAM_LOADING_LABELS,
	MERCHANT_TERMINALS_LOADING_LABELS,
	MERCHANT_VERIFICATION_LOADING_LABELS,
	MERCHANT_WORKSPACE_LOADING_LABELS,
	MerchantWorkspaceSkeleton,
	REDEMPTION_SKELETON_ROWS,
	REDEMPTION_STAT_CARDS,
	TEAM_INVITE_SKELETON_ROWS,
	TEAM_MEMBER_SKELETON_ROWS,
} from "@/components/loading/merchant-page-skeletons";
import { TEAM_INVITE_LOADING_LABELS } from "@/components/team-invite/team-invite-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { MERCHANT_ONBOARDING_LOADING_LABELS, MERCHANT_ONBOARDING_STEP_COUNT } from "@workspace/client/lib/merchant/onboarding/view";

// The entry loading reads the saved sidebar state on the server; each test chooses it.
const sidebarCookie = vi.hoisted((): { open: boolean | undefined } => ({ open: undefined }));
vi.mock("@/lib/merchant-server-api", () => ({
	readSidebarOpen: (): Promise<boolean | undefined> => Promise.resolve(sidebarCookie.open),
}));

/** A desktop viewport with motion allowed — the panel shell asks (jsdom has no `matchMedia`). */
function desktopMediaQueryList(query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> {
	return { matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
}

beforeEach((): void => {
	vi.stubGlobal("matchMedia", desktopMediaQueryList);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** The org dashboard's two columns of shortcut links. */
const DASHBOARD_LINK_COLUMNS = 2;
/** The analytics page's time-series charts. */
const ANALYTICS_CHARTS = 4;
/** The organization-settings link cards: team, locations, verification. */
const SETTINGS_LINK_CARDS = 3;
/** The invitation's detail rows: role, invited email, location access. */
const INVITE_DETAILS = 3;

/** One structural landmark of a route's skeleton, and how many of it the page draws. */
interface SkeletonLandmark {
	readonly selector: string;
	readonly count: number;
}

interface RouteLoadingCase {
	readonly route: string;
	/** The route's `loading.tsx`, rendered. */
	readonly element: React.ReactElement;
	readonly labels: UiKitLabelsOverride<"skeletonRegion">;
	readonly landmarks: readonly SkeletonLandmark[];
}

function slot(name: string): string {
	return `[data-slot="${name}"]`;
}

const ROUTES: readonly RouteLoadingCase[] = [
	{
		route: "/ and /account (entry redirects)",
		element: <MerchantWorkspaceSkeleton sidebarOpen />,
		labels: MERCHANT_WORKSPACE_LOADING_LABELS,
		landmarks: [
			{ selector: slot("app-panel-shell"), count: 1 },
			{ selector: slot("workspace-sidebar-skeleton"), count: 1 },
			{ selector: slot("app-shell-header-skeleton"), count: 1 },
			{ selector: slot("dashboard-links-skeleton"), count: DASHBOARD_LINK_COLUMNS },
		],
	},
	{
		route: "/auth/*",
		element: <MerchantAuthLoading />,
		labels: MERCHANT_AUTH_LOADING_LABELS,
		landmarks: [
			{ selector: slot("auth-brand-skeleton"), count: 1 },
			{ selector: slot("form-skeleton"), count: 1 },
		],
	},
	{
		route: "/onboarding",
		element: <MerchantOnboardingLoading />,
		labels: MERCHANT_ONBOARDING_LOADING_LABELS,
		landmarks: [{ selector: slot("onboarding-step-skeleton"), count: MERCHANT_ONBOARDING_STEP_COUNT }],
	},
	{
		route: "/team-invite",
		element: <MerchantTeamInviteLoading />,
		labels: TEAM_INVITE_LOADING_LABELS,
		landmarks: [{ selector: slot("team-invite-detail-skeleton"), count: INVITE_DETAILS }],
	},
	{
		route: "/orgs/[orgSlug]",
		element: <MerchantOrganizationLoading />,
		labels: MERCHANT_DASHBOARD_LOADING_LABELS,
		landmarks: [{ selector: slot("dashboard-links-skeleton"), count: DASHBOARD_LINK_COLUMNS }],
	},
	{
		route: "/orgs/[orgSlug]/dashboard",
		element: <MerchantDashboardLoading />,
		labels: MERCHANT_DASHBOARD_LOADING_LABELS,
		landmarks: [
			{ selector: slot("dashboard-links-skeleton"), count: DASHBOARD_LINK_COLUMNS },
			{ selector: slot("merchant-stat-cards-skeleton"), count: 1 },
		],
	},
	{
		route: "/orgs/[orgSlug]/account",
		element: <MerchantAccountLoading />,
		labels: MERCHANT_ACCOUNT_LOADING_LABELS,
		landmarks: [
			{ selector: slot("page-header-skeleton"), count: 1 },
			{ selector: slot("security-settings-panel-skeleton"), count: 1 },
		],
	},
	{
		route: "/orgs/[orgSlug]/analytics",
		element: <MerchantAnalyticsLoading />,
		labels: MERCHANT_ANALYTICS_LOADING_LABELS,
		landmarks: [
			{ selector: slot("analytics-range-skeleton"), count: 1 },
			{ selector: slot("stat-cards-skeleton"), count: 2 },
			{ selector: slot("chart-skeleton"), count: ANALYTICS_CHARTS },
		],
	},
	{
		route: "/orgs/[orgSlug]/api-keys",
		element: <MerchantApiKeysLoading />,
		labels: MERCHANT_API_KEYS_LOADING_LABELS,
		landmarks: [
			{ selector: slot("merchant-stat-card-skeleton"), count: FLEET_STAT_CARDS },
			{ selector: slot("merchant-grid-row-skeleton"), count: FLEET_SKELETON_ROWS },
		],
	},
	{
		route: "/orgs/[orgSlug]/terminals",
		element: <MerchantTerminalsLoading />,
		labels: MERCHANT_TERMINALS_LOADING_LABELS,
		landmarks: [
			{ selector: slot("merchant-stat-card-skeleton"), count: FLEET_STAT_CARDS },
			{ selector: slot("merchant-grid-row-skeleton"), count: FLEET_SKELETON_ROWS },
		],
	},
	{
		route: "/orgs/[orgSlug]/redemptions",
		element: <MerchantRedemptionsLoading />,
		labels: MERCHANT_REDEMPTIONS_LOADING_LABELS,
		landmarks: [
			{ selector: slot("merchant-stat-card-skeleton"), count: REDEMPTION_STAT_CARDS },
			{ selector: slot("merchant-bordered-row-skeleton"), count: REDEMPTION_SKELETON_ROWS },
		],
	},
	{
		route: "/orgs/[orgSlug]/rewards",
		element: <MerchantRewardsLoading />,
		labels: MERCHANT_REWARDS_LOADING_LABELS,
		landmarks: [
			{ selector: slot("rewards-summary-skeleton"), count: 1 },
			{ selector: slot("rewards-grid-skeleton"), count: 1 },
		],
	},
	{
		route: "/orgs/[orgSlug]/rewards/new",
		element: <MerchantCreateRewardLoading />,
		labels: MERCHANT_REWARD_EDITOR_LOADING_LABELS,
		landmarks: [
			{ selector: slot("reward-stores-skeleton"), count: 1 },
			{ selector: slot("reward-performance-skeleton"), count: 0 },
		],
	},
	{
		route: "/orgs/[orgSlug]/rewards/[rewardId]/edit",
		element: <MerchantEditRewardLoading />,
		labels: MERCHANT_REWARD_LOADING_LABELS,
		landmarks: [
			{ selector: slot("reward-performance-skeleton"), count: 1 },
			{ selector: slot("reward-stores-skeleton"), count: 0 },
		],
	},
	{
		route: "/orgs/[orgSlug]/settings",
		element: <MerchantSettingsLoading />,
		labels: MERCHANT_SETTINGS_LOADING_LABELS,
		landmarks: [{ selector: slot("settings-link-skeleton"), count: SETTINGS_LINK_CARDS }],
	},
	{
		route: "/orgs/[orgSlug]/settings/locations",
		element: <MerchantLocationsLoading />,
		labels: MERCHANT_LOCATIONS_LOADING_LABELS,
		landmarks: [{ selector: slot("location-card-skeleton"), count: LOCATION_SKELETON_CARDS }],
	},
	{
		route: "/orgs/[orgSlug]/settings/team",
		element: <MerchantTeamLoading />,
		labels: MERCHANT_TEAM_LOADING_LABELS,
		landmarks: [{ selector: slot("merchant-bordered-row-skeleton"), count: TEAM_MEMBER_SKELETON_ROWS + TEAM_INVITE_SKELETON_ROWS }],
	},
	{
		route: "/orgs/[orgSlug]/settings/verification",
		element: <MerchantVerificationLoading />,
		labels: MERCHANT_VERIFICATION_LOADING_LABELS,
		landmarks: [{ selector: slot("kyb-verification-skeleton"), count: 1 }],
	},
];

describe("route loading skeletons", () => {
	it.each(ROUTES)("$route announces exactly one busy region, naming what loads", ({ element, labels }) => {
		render(element, { wrapper: UiKitTestProviders });

		expect(busyRegionAnnouncements()).toEqual([labels.loading]);
		expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
	});

	it.each(ROUTES)("$route draws the page's own silhouette", ({ element, landmarks }) => {
		const { container } = render(element, { wrapper: UiKitTestProviders });

		for (const { selector, count } of landmarks) {
			expect(container.querySelectorAll(selector), selector).toHaveLength(count);
		}
	});

	it.each(ROUTES)("$route keeps every bone out of the accessibility tree", ({ element }) => {
		const { container } = render(element, { wrapper: UiKitTestProviders });

		const bones = Array.from(container.querySelectorAll(slot("skeleton")));
		expect(bones.length).toBeGreaterThan(0);
		expect(bones.every((bone: Element): boolean => bone.closest('[aria-hidden="true"]') !== null)).toBe(true);
	});
});

describe("public route loading chrome", () => {
	it("keeps the onboarding page's real title around the wizard skeleton", () => {
		render(<MerchantOnboardingLoading />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("heading", { level: 1, name: "Set up your store" })).toBeTruthy();
	});

	it("keeps the team-invitation page's brand header around the card skeleton", () => {
		render(<MerchantTeamInviteLoading />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Team invitation")).toBeTruthy();
	});
});

describe("workspace loading shell", () => {
	function sidebar(container: HTMLElement): Element | null {
		return container.querySelector('[data-slot="sidebar"]');
	}

	it("is the real panel shell with the real sidebar header — the brand never loads", () => {
		render(<MerchantWorkspaceSkeleton sidebarOpen />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(MERCHANT_SIDEBAR_MENU.header.title)).toBeTruthy();
		expect(screen.getByText(MERCHANT_SIDEBAR_MENU.header.subtitle)).toBeTruthy();
	});

	it("outlines exactly the merchant menu: a label per section and a row per item, then the footer's rows", () => {
		const { container } = render(<MerchantWorkspaceSkeleton sidebarOpen />, { wrapper: UiKitTestProviders });
		const outline = container.querySelector(slot("workspace-sidebar-skeleton"));
		const menuRows = MERCHANT_SIDEBAR_MENU.sections.reduce((total, section): number => total + section.items.length, 0);

		expect(outline?.querySelectorAll('[data-slot="sidebar-group"]').length).toBe(MERCHANT_SIDEBAR_MENU.sections.length);
		expect(outline?.querySelectorAll('[data-slot="sidebar-content"] li').length).toBe(menuRows);
		expect(outline?.querySelectorAll('[data-slot="sidebar-footer"] li').length).toBe(MERCHANT_SIDEBAR_MENU.bottomItems.length);
	});

	it("opens or collapses the sidebar as the member left it", async () => {
		sidebarCookie.open = false;
		const collapsed = render(await MerchantEntryLoading(), { wrapper: UiKitTestProviders });
		expect(sidebar(collapsed.container)?.getAttribute("data-state")).toBe("collapsed");
		cleanup();

		sidebarCookie.open = undefined;
		const fresh = render(await MerchantEntryLoading(), { wrapper: UiKitTestProviders });
		expect(sidebar(fresh.container)?.getAttribute("data-state")).toBe("expanded");
	});
});
