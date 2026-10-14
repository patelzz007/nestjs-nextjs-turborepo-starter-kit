// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { EmailTemplateKeySchema } from "@workspace/shared";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, describe, expect, it } from "vitest";

import { AccessControlPageSkeleton, PermissionGroupsSkeleton, RoleRowsSkeleton } from "@/components/loading/access-control-skeletons";
import { ProfilePageSkeleton, SecurityPageSkeleton } from "@/components/loading/account-skeletons";
import { AuditLogDetailPageSkeleton, AuditLogDrawerSkeleton, AuditLogRecordSkeleton } from "@/components/loading/audit-log-skeletons";
import { DataChangeDetailPageSkeleton, DataChangeDrawerSkeleton, DataChangeRecordSkeleton } from "@/components/loading/data-change-skeletons";
import {
	CATEGORY_DETAIL_SHAPE,
	CATEGORY_FORM_SHAPE,
	CatalogDetailPageSkeleton,
	CatalogEditorPageSkeleton,
	PRODUCT_DETAIL_SHAPE,
	PRODUCT_FORM_SHAPE,
	type CatalogDetailShape,
	type CatalogFormShape,
} from "@/components/loading/catalog-skeletons";
import { AnalyticsPageSkeleton, DashboardPageSkeleton } from "@/components/loading/dashboard-skeletons";
import { EmailPreviewBodySkeleton, EmailTemplateMetaSkeleton, EmailTemplatesPageSkeleton } from "@/components/loading/email-skeletons";
import { GeographyPageSkeleton } from "@/components/loading/geography-skeleton";
import { PANEL_LOADING_LABELS, PRODUCT_LOADING_LABELS, ROUTE_ACCESS_LOADING_LABELS, SECTION_LOADING_LABELS, USERS_LOADING_LABELS } from "@/components/loading/loading-labels";
import {
	KybMerchantCardSkeleton,
	KybQueueItemsSkeleton,
	KybReviewPageSkeleton,
	MerchantInvitesPageSkeleton,
	StoreRequestRowsSkeleton,
	StoreRequestsPageSkeleton,
} from "@/components/loading/merchant-skeletons";
import { PanelContentSkeleton, PanelNotFoundSkeleton } from "@/components/loading/panel-skeletons";
import { PendingRewardItemsSkeleton, PendingRewardsPageSkeleton } from "@/components/loading/rewards-skeletons";
import { SectionBones, SectionSkeleton } from "@/components/loading/section-skeleton";
import { BadgeSkeleton, CardHeadingSkeleton, LabelledValueGridSkeleton } from "@/components/loading/skeleton-parts";
import {
	AUDIT_LOG_TABLE_PAGE,
	CATEGORIES_TABLE_PAGE,
	EMAIL_LOG_TABLE_PAGE,
	MERCHANTS_TABLE_PAGE,
	MFA_RECOVERY_TABLE_PAGE,
	PRODUCTS_TABLE_PAGE,
	TABLE_PAGE_SKELETON_ROWS,
	TablePageSkeleton,
	USERS_TABLE_PAGE,
	type TablePageShape,
} from "@/components/loading/table-page-skeleton";
import { MfaRecoveryRequestSkeleton, UserDetailPageSkeleton } from "@/components/loading/user-skeletons";
import { ADMIN_CUSTOMER_KPIS, ADMIN_REWARD_KPIS, ADMIN_SALES_KPIS } from "@/lib/analytics/admin-analytics";

afterEach(() => {
	cleanup();
});

/** The single busy status region of a render; fails when there is none or more than one. */
function onlyStatus(): HTMLElement {
	const regions = screen.getAllByRole("status");
	expect(regions).toHaveLength(1);
	const [region] = regions;
	if (region === undefined) {
		throw new Error("No status region rendered.");
	}
	expect(region.getAttribute("aria-busy")).toBe("true");
	return region;
}

function count(root: ParentNode, selector: string): number {
	return root.querySelectorAll(selector).length;
}

describe("skeleton parts", () => {
	it("draws a card heading with and without its description line", () => {
		const { container, rerender } = render(<CardHeadingSkeleton />);
		expect(count(container, '[data-slot="skeleton"]')).toBe(2);

		rerender(<CardHeadingSkeleton withDescription={false} />);
		expect(count(container, '[data-slot="skeleton"]')).toBe(1);
	});

	it("draws one label/value pair per cell, in the grid classes it is given", () => {
		const cells = 5;
		const { container } = render(<LabelledValueGridSkeleton count={cells} className="sm:grid-cols-2" />);

		const [grid] = container.children;
		expect(grid?.classList.contains("sm:grid-cols-2")).toBe(true);
		expect(grid?.children).toHaveLength(cells);
	});

	it("draws a pill-shaped badge that takes extra width classes", () => {
		const { container } = render(<BadgeSkeleton className="w-24" />);

		const bone = container.querySelector('[data-slot="skeleton"]');
		expect(bone?.classList.contains("rounded-full")).toBe(true);
		expect(bone?.classList.contains("w-24")).toBe(true);
	});
});

describe("TablePageSkeleton", () => {
	const shapes: readonly { readonly name: string; readonly shape: TablePageShape }[] = [
		{ name: "users", shape: USERS_TABLE_PAGE },
		{ name: "merchants", shape: MERCHANTS_TABLE_PAGE },
		{ name: "products", shape: PRODUCTS_TABLE_PAGE },
		{ name: "categories", shape: CATEGORIES_TABLE_PAGE },
		{ name: "audit log", shape: AUDIT_LOG_TABLE_PAGE },
		{ name: "email log", shape: EMAIL_LOG_TABLE_PAGE },
		{ name: "MFA recovery", shape: MFA_RECOVERY_TABLE_PAGE },
	];

	it.each(shapes)("draws the $name page's header and every column of its table", ({ shape }) => {
		render(<TablePageSkeleton labels={USERS_LOADING_LABELS} shape={shape} />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading users…");
		expect(region.querySelector('[data-slot="page-header-skeleton"]')).not.toBeNull();
		const table = region.querySelector('[data-slot="table-skeleton"]');
		expect(table).not.toBeNull();
		expect(count(table ?? region, "thead th")).toBe(shape.columns);
		expect(count(table ?? region, "tbody tr")).toBe(TABLE_PAGE_SKELETON_ROWS);
		for (const widthClass of shape.className.split(" ").filter((name) => name.length > 0)) {
			expect(region.classList.contains(widthClass)).toBe(true);
		}
	});
});

describe("catalog skeletons", () => {
	const forms: readonly { readonly name: string; readonly shape: CatalogFormShape }[] = [
		{ name: "product", shape: PRODUCT_FORM_SHAPE },
		{ name: "category", shape: CATEGORY_FORM_SHAPE },
	];

	it.each(forms)("draws every field and switch of the $name form", ({ shape }) => {
		render(<CatalogEditorPageSkeleton labels={PRODUCT_LOADING_LABELS} shape={shape} />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading product…");
		expect(count(region, '[data-skeleton="catalog-field"]')).toBe(shape.gridFields + shape.singleLineFields + shape.multilineFields);
		expect(count(region, '[data-skeleton="catalog-switch"]')).toBe(shape.switches);
	});

	const details: readonly { readonly name: string; readonly shape: CatalogDetailShape }[] = [
		{ name: "product", shape: PRODUCT_DETAIL_SHAPE },
		{ name: "category", shape: CATEGORY_DETAIL_SHAPE },
	];

	it.each(details)("draws every field of the $name detail sheet", ({ shape }) => {
		render(<CatalogDetailPageSkeleton labels={PRODUCT_LOADING_LABELS} shape={shape} />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		const sheet = region.querySelector('[data-slot="detail-skeleton"]');
		expect(count(sheet ?? region, ":scope > div > div")).toBe(shape.fields);
	});
});

describe("audit log skeletons", () => {
	/** Who, When, Device & location, Request headers, Tracing. */
	const RECORD_SECTIONS = 5;
	/** Route params & query, request body, response body. */
	const RECORD_PAYLOADS = 3;

	it("draws the record's five sections and three payload panels", () => {
		const { container } = render(<AuditLogRecordSkeleton layout="page" />);

		expect(count(container, '[data-skeleton="audit-log-record-section"]')).toBe(RECORD_SECTIONS);
		expect(count(container, '[data-skeleton="audit-log-record-payload"]')).toBe(RECORD_PAYLOADS);
	});

	it("uses the page layout's three-column grids on the page, the drawer's two-column ones in the drawer", () => {
		const { container, rerender } = render(<AuditLogRecordSkeleton layout="page" />);
		expect(container.querySelector('[data-skeleton="audit-log-record-section"] .lg\\:grid-cols-3')).not.toBeNull();

		rerender(<AuditLogRecordSkeleton layout="drawer" />);
		expect(container.querySelector('[data-skeleton="audit-log-record-section"] .lg\\:grid-cols-3')).toBeNull();
		expect(container.querySelector('[data-skeleton="audit-log-record-section"] .sm\\:grid-cols-2')).not.toBeNull();
	});

	it("announces the record in the drawer and on its own page", () => {
		render(<AuditLogDrawerSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Loading audit record…");
		cleanup();

		render(<AuditLogDetailPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().querySelector('[data-skeleton="audit-log-record"]')).not.toBeNull();
	});
});

describe("data change skeletons", () => {
	/** Who, When, Database connection, Tracing. */
	const RECORD_SECTIONS = 4;

	it("draws the before / after table and the record's four sections", () => {
		const { container } = render(<DataChangeRecordSkeleton layout="page" />);

		expect(count(container, '[data-skeleton="data-change-diff"]')).toBe(1);
		expect(count(container, '[data-skeleton="data-change-record-section"]')).toBe(RECORD_SECTIONS);
	});

	it("uses the page layout's three-column grids on the page, the drawer's two-column ones in the drawer", () => {
		const { container, rerender } = render(<DataChangeRecordSkeleton layout="page" />);
		expect(container.querySelector('[data-skeleton="data-change-record-section"] .lg\\:grid-cols-3')).not.toBeNull();

		rerender(<DataChangeRecordSkeleton layout="drawer" />);
		expect(container.querySelector('[data-skeleton="data-change-record-section"] .lg\\:grid-cols-3')).toBeNull();
	});

	it("announces the row change in the drawer and on its own page", () => {
		render(<DataChangeDrawerSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Loading row change…");
		cleanup();

		render(<DataChangeDetailPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().querySelector('[data-skeleton="data-change-record"]')).not.toBeNull();
	});
});

describe("email skeletons", () => {
	it("draws one index row per template the API renders", () => {
		render(<EmailTemplatesPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading email templates…");
		expect(count(region, '[data-skeleton="email-template-row"]')).toBe(EmailTemplateKeySchema.options.length);
		expect(region.querySelector('[data-skeleton="email-template-meta"]')).not.toBeNull();
		expect(region.querySelector('[data-skeleton="email-preview-body"]')?.classList.contains("h-180")).toBe(true);
	});

	it("exposes the preview body and template meta as bones for the view's own regions", () => {
		const { container } = render(
			<>
				<EmailTemplateMetaSkeleton />
				<EmailPreviewBodySkeleton />
			</>,
		);

		expect(container.querySelector('[data-skeleton="email-template-meta"]')).not.toBeNull();
		expect(container.querySelector('[data-skeleton="email-preview-body"]')).not.toBeNull();
		expect(screen.queryByRole("status")).toBeNull();
	});
});

describe("merchant skeletons", () => {
	it("draws the invite compose card beside the email preview", () => {
		render(<MerchantInvitesPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading merchant invites…");
		expect(count(region, '[data-skeleton="invite-compose-row"]')).toBeGreaterThan(0);
		expect(region.querySelector('[data-skeleton="email-inbox-preview"]')).not.toBeNull();
	});

	it("draws the store-request queue rows in the page and on their own", () => {
		render(<StoreRequestsPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Loading store requests…");
		cleanup();

		const { container } = render(<StoreRequestRowsSkeleton />);
		expect(count(container, '[data-skeleton="store-request-row"]')).toBeGreaterThan(0);
	});

	it("draws the KYB queue, and the merchant card the view shows while a merchant loads", () => {
		render(<KybReviewPageSkeleton />, { wrapper: UiKitTestProviders });
		const region = onlyStatus();
		expect(region.textContent).toBe("Loading KYB review…");
		expect(count(region, '[data-skeleton="kyb-queue-item"]')).toBeGreaterThan(0);
		cleanup();

		const { container } = render(
			<>
				<KybQueueItemsSkeleton />
				<KybMerchantCardSkeleton />
			</>,
		);
		expect(count(container, '[data-skeleton="kyb-queue-item"]')).toBeGreaterThan(0);
		expect(container.querySelector('[data-skeleton="kyb-merchant-card"]')).not.toBeNull();
	});
});

describe("rewards, geography, users, account and access skeletons", () => {
	it("draws the moderation queue's reward cards", () => {
		render(<PendingRewardsPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Loading pending rewards…");
		cleanup();

		const { container } = render(<PendingRewardItemsSkeleton />);
		const rewardCards = count(container, '[data-skeleton="pending-reward"]');
		expect(rewardCards).toBeGreaterThan(0);
		// Every card holds the cover the reviewer moderates.
		expect(count(container, '[data-skeleton="pending-reward-cover"]')).toBe(rewardCards);
	});

	it("draws geography's five stat cards, the tab control and the bare table", () => {
		/** Regions, subregions, countries, states, cities. */
		const GEO_STATS = 5;
		render(<GeographyPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(count(region, '[data-skeleton="geo-stat-card"]')).toBe(GEO_STATS);
		expect(region.querySelector('[data-skeleton="geo-tabs"]')).not.toBeNull();
		// The real table sits bare on the page, not in a card.
		expect(region.querySelector('[data-slot="table-skeleton"]')).not.toBeNull();
		expect(region.querySelector('[data-slot="table-skeleton"] [data-slot="card-header"]')).toBeNull();
	});

	it("draws the user detail's header and every profile section", () => {
		/** Identity, signup referral, account status, security, audit. */
		const PROFILE_SECTIONS = 5;
		render(<UserDetailPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading user…");
		expect(region.querySelector('[data-skeleton="user-detail-header"]')).not.toBeNull();
		expect(count(region, '[data-skeleton="user-profile-section"]')).toBe(PROFILE_SECTIONS);
	});

	it("draws one MFA recovery request as bones", () => {
		const { container } = render(<MfaRecoveryRequestSkeleton />);
		expect(container.querySelector('[data-skeleton="mfa-recovery-request"]')).not.toBeNull();
	});

	it("draws the profile card and the security grid", () => {
		/** Email verification, change password, two-factor, signed-in devices, MFA recovery. */
		const SECURITY_SECTIONS = 5;
		render(<ProfilePageSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().querySelector('[data-skeleton="profile-avatar"]')).not.toBeNull();
		cleanup();

		render(<SecurityPageSkeleton />, { wrapper: UiKitTestProviders });
		const region = onlyStatus();
		expect(region.textContent).toBe("Loading security settings…");
		expect(count(region, '[data-skeleton="security-section"]')).toBe(SECURITY_SECTIONS);
	});

	it("draws the access-control roles card, and the role and permission rows the panel loads into", () => {
		render(<AccessControlPageSkeleton />, { wrapper: UiKitTestProviders });
		expect(count(onlyStatus(), '[data-skeleton="role-row"]')).toBeGreaterThan(0);
		cleanup();

		const { container } = render(
			<>
				<RoleRowsSkeleton />
				<PermissionGroupsSkeleton />
			</>,
		);
		expect(count(container, '[data-skeleton="role-row"]')).toBeGreaterThan(0);
		expect(count(container, '[data-skeleton="permission-group"]')).toBeGreaterThan(0);
	});
});

describe("dashboard and analytics skeletons", () => {
	/** Sales, bills, claims & redemptions, new vs returning customers. */
	const TIME_SERIES_PANELS = 4;
	/** Top merchants, sales by category, sales by city. */
	const BREAKDOWN_PANELS = 3;

	it("draws one stat card per analytics KPI, the four time series and the three breakdowns", () => {
		render(<AnalyticsPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading analytics…");
		const statCards = region.querySelectorAll('[data-slot="stat-cards-skeleton"] > [data-slot="card"]');
		expect(statCards).toHaveLength(ADMIN_SALES_KPIS.length + ADMIN_CUSTOMER_KPIS.length + ADMIN_REWARD_KPIS.length);
		expect(count(region, '[data-slot="chart-skeleton"]')).toBe(TIME_SERIES_PANELS);
		expect(count(region, '[data-slot="list-skeleton"]')).toBe(BREAKDOWN_PANELS);
	});

	it("draws the dashboard's sales headline with one stat card per sales KPI", () => {
		render(<DashboardPageSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading dashboard…");
		expect(count(region, '[data-slot="stat-cards-skeleton"] > [data-slot="card"]')).toBe(ADMIN_SALES_KPIS.length);
		expect(count(region, '[data-skeleton="section"]')).toBeGreaterThan(0);
	});
});

describe("section skeleton", () => {
	it("reserves the section's height inside an announced region", () => {
		render(<SectionSkeleton height="h-40" />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe(SECTION_LOADING_LABELS.loading);
		expect(region.querySelector('[data-skeleton="section"]')?.classList.contains("h-40")).toBe(true);
	});

	it("announces a caller's own label", () => {
		render(<SectionSkeleton height="h-24" labels={PANEL_LOADING_LABELS} />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Loading page…");
	});

	it("draws bare bones without a region of their own", () => {
		const { container } = render(<SectionBones height="h-24" />);
		expect(container.querySelector('[data-skeleton="section"]')?.classList.contains("h-24")).toBe(true);
		expect(screen.queryByRole("status")).toBeNull();
	});
});

describe("panel skeletons", () => {
	it("draws a page header over a table by default and announces the page", () => {
		render(<PanelContentSkeleton />, { wrapper: UiKitTestProviders });

		const region = onlyStatus();
		expect(region.textContent).toBe("Loading page…");
		expect(region.querySelector('[data-slot="page-header-skeleton"]')).not.toBeNull();
		expect(region.querySelector('[data-slot="table-skeleton"]')).not.toBeNull();
	});

	it("announces the caller's label", () => {
		render(<PanelContentSkeleton labels={ROUTE_ACCESS_LOADING_LABELS} />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().textContent).toBe("Checking your access…");
	});

	it("draws the 404's centred code, copy and back link", () => {
		render(<PanelNotFoundSkeleton />, { wrapper: UiKitTestProviders });
		expect(onlyStatus().querySelector('[data-skeleton="not-found-code"]')).not.toBeNull();
	});

	it("keeps bone groups region-free, so composing several still announces once", () => {
		render(
			<SkeletonRegion labels={PANEL_LOADING_LABELS}>
				<RoleRowsSkeleton />
				<KybQueueItemsSkeleton />
				<PendingRewardItemsSkeleton />
			</SkeletonRegion>,
			{ wrapper: UiKitTestProviders },
		);
		expect(onlyStatus().textContent).toBe("Loading page…");
	});
});
