// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import AccountLoading from "../account/loading";
import AccountProfileLoading from "../account/profile/loading";
import AccountSecurityLoading from "../account/security/loading";
import AnalyticsLoading from "../analytics/loading";
import AuditLogDetailLoading from "../audit-logs/[id]/loading";
import AuditLogsLoading from "../audit-logs/loading";
import CatalogLoading from "../catalog/loading";
import ComponentPageLoading from "../components/(gallery)/[slug]/loading";
import ComponentsLoading from "../components/(gallery)/loading";
import EditCategoryLoading from "../catalog/categories/[id]/edit/loading";
import CategoryDetailLoading from "../catalog/categories/[id]/loading";
import CategoriesLoading from "../catalog/categories/loading";
import NewCategoryLoading from "../catalog/categories/new/loading";
import EditProductLoading from "../catalog/products/[id]/edit/loading";
import ProductDetailLoading from "../catalog/products/[id]/loading";
import ProductsLoading from "../catalog/products/loading";
import NewProductLoading from "../catalog/products/new/loading";
import EmailsLoading from "../emails/loading";
import EmailLogLoading from "../emails/log/loading";
import EmailTemplatesLoading from "../emails/templates/loading";
import GeographyLoading from "../geography/loading";
import DashboardLoading from "../(home)/loading";
import PanelLoading from "../loading";
import MerchantDetailLoading from "../merchants/[id]/loading";
import MerchantInvitesLoading from "../merchants/invites/loading";
import MerchantsLoading from "../merchants/loading";
import StoreRequestsLoading from "../merchants/store-requests/loading";
import MerchantVerificationLoading from "../merchants/verification/loading";
import RewardsLoading from "../rewards/loading";
import RewardsReviewLoading from "../rewards/review/loading";
import RewardReviewDetailLoading from "../rewards/review/[id]/loading";
import AccessControlLoading from "../settings/access/loading";
import SettingsLoading from "../settings/loading";
import PanelCatchAllLoading from "../[...slug]/loading";
import UserDetailLoading from "../users/[id]/loading";
import UsersLoading from "../users/loading";
import MfaRecoveryLoading from "../users/mfa-recovery/loading";
import SupportAccessLoading from "../users/support-access/loading";

afterEach(() => {
	cleanup();
});

interface RouteLoadingCase {
	readonly route: string;
	/** The route's `loading.tsx` default export. */
	readonly loadingView: () => React.JSX.Element;
	/** What the single status region announces. */
	readonly announcement: string;
	/** Parts of the page's real layout the skeleton must draw (kit `data-slot`s and admin `data-skeleton`s). */
	readonly landmarks: readonly string[];
}

const PAGE_HEADER = '[data-slot="page-header-skeleton"]';
const TABLE = '[data-slot="table-skeleton"]';

const ROUTE_CASES: readonly RouteLoadingCase[] = [
	{ route: "(panel) fallback", loadingView: PanelLoading, announcement: "Loading page…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/",
		loadingView: DashboardLoading,
		announcement: "Loading dashboard…",
		landmarks: ['[data-skeleton="demo-anchor"]', '[data-slot="stat-cards-skeleton"]', '[data-slot="chart-skeleton"]', '[data-skeleton="section"]'],
	},
	{ route: "/[...slug]", loadingView: PanelCatchAllLoading, announcement: "Loading page…", landmarks: ['[data-skeleton="not-found-code"]'] },
	{
		route: "/analytics",
		loadingView: AnalyticsLoading,
		announcement: "Loading analytics…",
		landmarks: [PAGE_HEADER, '[data-slot="stat-cards-skeleton"]', '[data-slot="chart-skeleton"]', '[data-slot="list-skeleton"]'],
	},
	{ route: "/audit-logs", loadingView: AuditLogsLoading, announcement: "Loading audit log…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/audit-logs/[id]",
		loadingView: AuditLogDetailLoading,
		announcement: "Loading audit record…",
		landmarks: ['[data-skeleton="audit-log-record"]', '[data-skeleton="audit-log-record-payload"]'],
	},
	{ route: "/catalog", loadingView: CatalogLoading, announcement: "Loading products…", landmarks: [PAGE_HEADER, TABLE] },
	{ route: "/catalog/products", loadingView: ProductsLoading, announcement: "Loading products…", landmarks: [PAGE_HEADER, TABLE] },
	{ route: "/catalog/products/new", loadingView: NewProductLoading, announcement: "Loading product form…", landmarks: ['[data-skeleton="catalog-form"]'] },
	{
		route: "/catalog/products/[id]",
		loadingView: ProductDetailLoading,
		announcement: "Loading product…",
		landmarks: ['[data-skeleton="catalog-detail"]', '[data-slot="detail-skeleton"]'],
	},
	{ route: "/catalog/products/[id]/edit", loadingView: EditProductLoading, announcement: "Loading product…", landmarks: ['[data-skeleton="catalog-form"]'] },
	{ route: "/catalog/categories", loadingView: CategoriesLoading, announcement: "Loading categories…", landmarks: [PAGE_HEADER, TABLE] },
	{ route: "/catalog/categories/new", loadingView: NewCategoryLoading, announcement: "Loading category form…", landmarks: ['[data-skeleton="catalog-form"]'] },
	{
		route: "/catalog/categories/[id]",
		loadingView: CategoryDetailLoading,
		announcement: "Loading category…",
		landmarks: ['[data-skeleton="catalog-detail"]', '[data-slot="detail-skeleton"]'],
	},
	{ route: "/catalog/categories/[id]/edit", loadingView: EditCategoryLoading, announcement: "Loading category…", landmarks: ['[data-skeleton="catalog-form"]'] },
	{
		route: "/components",
		loadingView: ComponentsLoading,
		announcement: "Loading components…",
		landmarks: ['[data-skeleton="component-gallery-header"]', '[data-skeleton="component-gallery-family"]', '[data-skeleton="component-gallery-card"]'],
	},
	{
		route: "/components/[slug]",
		loadingView: ComponentPageLoading,
		announcement: "Loading component…",
		landmarks: ['[data-skeleton="component-page-header"]', '[data-skeleton="section"]'],
	},
	{
		route: "/emails",
		loadingView: EmailsLoading,
		announcement: "Loading email templates…",
		landmarks: [PAGE_HEADER, '[data-skeleton="email-template-row"]', '[data-skeleton="email-preview-body"]'],
	},
	{
		route: "/emails/templates",
		loadingView: EmailTemplatesLoading,
		announcement: "Loading email templates…",
		landmarks: [PAGE_HEADER, '[data-skeleton="email-template-row"]', '[data-skeleton="email-preview-body"]'],
	},
	{ route: "/emails/log", loadingView: EmailLogLoading, announcement: "Loading email log…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/geography",
		loadingView: GeographyLoading,
		announcement: "Loading geographic data…",
		landmarks: [PAGE_HEADER, '[data-skeleton="geo-stat-card"]', '[data-skeleton="geo-tabs"]', TABLE],
	},
	{ route: "/merchants", loadingView: MerchantsLoading, announcement: "Loading merchants…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/merchants/[id]",
		loadingView: MerchantDetailLoading,
		announcement: "Loading merchant…",
		landmarks: [PAGE_HEADER, '[data-skeleton="merchant-summary"]', '[data-skeleton="merchant-lifecycle"]'],
	},
	{
		route: "/merchants/invites",
		loadingView: MerchantInvitesLoading,
		announcement: "Loading merchant invites…",
		landmarks: [PAGE_HEADER, '[data-skeleton="invite-compose-row"]', '[data-skeleton="email-inbox-preview"]'],
	},
	{
		route: "/merchants/store-requests",
		loadingView: StoreRequestsLoading,
		announcement: "Loading store requests…",
		landmarks: [PAGE_HEADER, '[data-skeleton="store-request-row"]'],
	},
	{
		route: "/merchants/verification",
		loadingView: MerchantVerificationLoading,
		announcement: "Loading KYB review…",
		landmarks: [PAGE_HEADER, '[data-skeleton="kyb-queue-item"]'],
	},
	{ route: "/rewards", loadingView: RewardsLoading, announcement: "Loading pending rewards…", landmarks: [PAGE_HEADER, '[data-skeleton="pending-reward"]'] },
	{ route: "/rewards/review", loadingView: RewardsReviewLoading, announcement: "Loading pending rewards…", landmarks: [PAGE_HEADER, '[data-skeleton="pending-reward"]'] },
	{
		route: "/rewards/review/[id]",
		loadingView: RewardReviewDetailLoading,
		announcement: "Loading reward…",
		landmarks: ['[data-skeleton="reward-review-header"]', '[data-skeleton="reward-review-photo"]', '[data-skeleton="reward-review-details"]'],
	},
	{ route: "/settings", loadingView: SettingsLoading, announcement: "Loading access control…", landmarks: [PAGE_HEADER, '[data-skeleton="role-row"]'] },
	{ route: "/settings/access", loadingView: AccessControlLoading, announcement: "Loading access control…", landmarks: [PAGE_HEADER, '[data-skeleton="role-row"]'] },
	{ route: "/users", loadingView: UsersLoading, announcement: "Loading users…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/users/[id]",
		loadingView: UserDetailLoading,
		announcement: "Loading user…",
		landmarks: ['[data-skeleton="user-detail-header"]', '[data-skeleton="user-profile-section"]'],
	},
	{ route: "/users/mfa-recovery", loadingView: MfaRecoveryLoading, announcement: "Loading MFA recovery requests…", landmarks: [PAGE_HEADER, TABLE] },
	{ route: "/users/support-access", loadingView: SupportAccessLoading, announcement: "Loading support access…", landmarks: [PAGE_HEADER, TABLE] },
	{
		route: "/account",
		loadingView: AccountLoading,
		announcement: "Loading security settings…",
		landmarks: [PAGE_HEADER, '[data-skeleton="security-section"]', '[data-slot="form-skeleton"]'],
	},
	{
		route: "/account/profile",
		loadingView: AccountProfileLoading,
		announcement: "Loading profile…",
		// The profile opens on an identity header (avatar, name, roles, facts) instead of a plain page header.
		landmarks: ['[data-skeleton="profile-identity"]', '[data-skeleton="profile-avatar"]', '[data-slot="form-skeleton"]'],
	},
	{
		route: "/account/security",
		loadingView: AccountSecurityLoading,
		announcement: "Loading security settings…",
		landmarks: [PAGE_HEADER, '[data-skeleton="security-section"]', '[data-slot="form-skeleton"]'],
	},
];

describe("panel route loading skeletons", () => {
	it.each(ROUTE_CASES)("$route announces one busy status and draws the page's shape", ({ loadingView, announcement, landmarks }) => {
		render(React.createElement(loadingView), { wrapper: UiKitTestProviders });

		const regions = screen.getAllByRole("status");
		expect(regions).toHaveLength(1);
		const [region] = regions;
		expect(region?.getAttribute("aria-busy")).toBe("true");
		expect(region?.getAttribute("aria-live")).toBe("polite");
		expect(region?.textContent).toBe(announcement);

		// Every bone is the kit's synchronized sheen, hidden from assistive technology.
		const bones = region?.querySelectorAll('[data-slot="skeleton"]') ?? [];
		expect(bones.length).toBeGreaterThan(0);
		for (const bone of bones) {
			expect(bone.classList.contains("skeleton-bone")).toBe(true);
			expect(bone.closest('[aria-hidden="true"]')).not.toBeNull();
		}
		expect(region?.querySelector(".animate-pulse")).toBeNull();

		for (const landmark of landmarks) {
			expect(region?.querySelector(landmark)).not.toBeNull();
		}
	});
});
