"use client";

import { API_KEY_ROW_ACTIONS, API_KEY_ROW_GRID, API_KEY_ROW_TEXT_CELLS } from "@/components/api-keys/api-key-row-grid";
import {
	MerchantBorderedRowsSkeleton,
	MerchantGridRowsSkeleton,
	MerchantHeadingSkeleton,
	MerchantPageHeaderSkeleton,
	MerchantSectionCardSkeleton,
	MerchantStatCardsSkeleton,
} from "@/components/loading/merchant-skeleton-parts";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { MerchantRewardsCatalogSkeleton } from "@/components/rewards/merchant-rewards-catalog";
import { MerchantRewardsSummaryStripSkeleton } from "@/components/rewards/merchant-rewards-summary-strip";
import { TERMINAL_ROW_ACTIONS, TERMINAL_ROW_GRID, TERMINAL_ROW_TEXT_CELLS } from "@/components/terminals/terminal-row-grid";
import { TerminalSettingsRowSkeleton } from "@/components/terminals/terminal-settings-card";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { sidebarMenuSkeletonShape, type SidebarMenuSkeletonShape } from "@workspace/client/lib/sidebar/sidebar-menu-skeleton";
import { AppPanelShell } from "@workspace/ui/components/app-panel-shell";
import { BrandMark } from "@workspace/ui/components/brand-mark";
import { AppShellHeaderSkeleton, PanelSidebarSkeleton, type AppShellHeaderSkeletonAction } from "@workspace/ui/components/panel-shell-skeleton";
import { PanelSidebarHeader } from "@workspace/ui/components/panel-sidebar-header";
import { SecuritySettingsPanelSkeleton } from "@workspace/client/lib/auth/mfa/security-settings-panel-skeleton";
import { MerchantKybVerificationSkeleton } from "@workspace/client/lib/merchant/kyb/verification-skeleton";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChartSkeleton, FormSkeleton, ListSkeleton, PageHeaderSkeleton, ProseSkeleton, StatCardsSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/*
 * One skeleton per merchant page, each the page's own silhouette (header,
 * section order, cards vs bare panels, grid columns) inside exactly one
 * announced `SkeletonRegion`. A route's `loading.tsx` renders it while the
 * server prepares the page, and the page's capability gate renders the same
 * one while the membership resolves — so the content lands where it stood.
 * The merchant shell (sidebar, top bar) stays mounted around them.
 */

/** Pages stack their sections 2rem apart (`space-y-8`); the region is a flex column so the gap reaches the bones. */
const PAGE_STACK = "flex flex-col gap-8";

// ── Announcements ────────────────────────────────────────────────────────────

export const MERCHANT_WORKSPACE_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Opening your workspace…" };
export const MERCHANT_PAGE_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading page…" };
export const MERCHANT_ACCESS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Checking access…" };
export const MERCHANT_DASHBOARD_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading dashboard…" };
export const MERCHANT_ANALYTICS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading analytics…" };
export const MERCHANT_API_KEYS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading API keys…" };
export const MERCHANT_TERMINALS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading terminals…" };
export const MERCHANT_REDEMPTIONS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading redemptions…" };
export const MERCHANT_REWARDS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading rewards…" };
export const MERCHANT_REWARD_EDITOR_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading reward editor…" };
export const MERCHANT_REWARD_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading reward…" };
export const MERCHANT_SETTINGS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading settings…" };
export const MERCHANT_LOCATIONS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading store locations…" };
export const MERCHANT_BRANDING_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading store branding…" };
export const MERCHANT_TEAM_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading team…" };
export const MERCHANT_VERIFICATION_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading business verification…" };
export const MERCHANT_ACCOUNT_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading account…" };

// ── Counts (what a typical page holds; the real rows replace them) ───────────

/** Org dashboard KPI tiles: role, locations, KYB status, policy version. */
const DASHBOARD_STAT_CARDS = 4;
/** Shortcut links per dashboard column (administration, operations). */
const DASHBOARD_LINKS_PER_COLUMN = 3;
/** Dashboard columns of shortcut links. */
const DASHBOARD_LINK_COLUMNS = 2;
/** Notes under the dashboard hero ("You are here", "Merchant home"). */
const DASHBOARD_HERO_NOTES = 2;
/** Tenant-snapshot facts: organization ID, membership status, location scope, merchant contact. */
const DASHBOARD_SNAPSHOT_FACTS = 4;
/** Analytics sales KPIs (sales, bills, average bill, customers). */
const ANALYTICS_SALES_KPIS = 4;
/** Analytics reward KPIs (claims, redemptions, redemption rate). */
const ANALYTICS_REWARD_KPIS = 3;
/** Analytics time-series charts: sales, bills, average bill, claims and redemptions. */
const ANALYTICS_CHARTS = 4;
/** Analytics breakdowns: by store, by reward, by redemption method. */
const ANALYTICS_BREAKDOWNS = 3;
/** Rows per analytics breakdown. */
const ANALYTICS_BREAKDOWN_ROWS = 4;
/** Summary stat cards on the API-keys and terminals pages. */
export const FLEET_STAT_CARDS = 3;
/** The create-key form's fields: key name, store. */
const CREATE_KEY_FIELDS = 2;
/** Key / till rows while the list loads (a small fleet). */
export const FLEET_SKELETON_ROWS = 3;
/** Integration guide steps on the API-keys and terminals pages. */
const GUIDE_STEPS = 3;
/** Redemptions page stat cards: showing, today. */
export const REDEMPTION_STAT_CARDS = 2;
/** Redemption rows while the log loads. */
export const REDEMPTION_SKELETON_ROWS = 5;
/** Reward-type tiles in the reward editor (one per reward type). */
const REWARD_TYPE_TILES = 5;
/** "Basic information" fields: title, description, value, minimum purchase. */
const REWARD_BASIC_FIELDS = 4;
/** "Limits & duration" fields: start, expiry, total available, max claims per user. */
const REWARD_LIMIT_FIELDS = 4;
/** Reward performance tiles: claims, redemptions, category. */
const REWARD_PERFORMANCE_TILES = 3;
/** Store checkboxes in the reward editor's store availability card. */
const REWARD_STORE_OPTIONS = 2;
/** Organization-settings link cards: team, locations, verification. */
const SETTINGS_LINK_CARDS = 4;
/** Store-location cards while the locations load. */
export const LOCATION_SKELETON_CARDS = 4;
/** Team members while the roster loads. */
export const TEAM_MEMBER_SKELETON_ROWS = 3;
/** Pending invitations while they load. */
export const TEAM_INVITE_SKELETON_ROWS = 2;
/** Detail lines under a team member's name: email, store access. */
export const TEAM_MEMBER_LINES = 2;
/** Detail lines under an invitation's email: role and stores, inviter. */
export const TEAM_INVITE_LINES = 2;

// ── Shared fragments ─────────────────────────────────────────────────────────

/** A bordered link card: an icon tile, title and description, then the arrow. */
function NavLinkCardSkeleton({ index }: { readonly index: number }): React.JSX.Element {
	return (
		<div className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
			<Skeleton className="size-10 rounded-lg" />
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton variant="text" className={cn("h-4", cycledWidth(["w-32", "w-40", "w-36"], index))} />
				<Skeleton variant="text" className="h-3.5 w-full max-w-sm" />
			</div>
			<Skeleton className="mt-1 size-4 rounded-sm" />
		</div>
	);
}

/** An integration guide card: its header, then numbered steps of an icon and two lines. */
function GuideCardSkeleton(): React.JSX.Element {
	return (
		<MerchantSectionCardSkeleton>
			<div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
				{placeholderKeys("step", GUIDE_STEPS).map((key): React.JSX.Element => (
					<div key={key} className="flex items-start gap-3">
						<Skeleton className="size-8 rounded-lg" />
						<div className="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton variant="text" className="h-4 w-40" />
							<Skeleton variant="text" className="h-3.5 w-full max-w-lg" />
						</div>
					</div>
				))}
			</div>
		</MerchantSectionCardSkeleton>
	);
}

// ── Generic page ─────────────────────────────────────────────────────────────

export interface MerchantPageSkeletonProps {
	/** What the region announces. Default "Loading page…". */
	readonly labels?: UiKitLabelsOverride<"skeletonRegion">;
}

/** A merchant page whose shape is not known yet: the page header and one content panel. */
export function MerchantPageSkeleton({ labels = MERCHANT_PAGE_LOADING_LABELS }: MerchantPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantSurfacePanel className="p-6">
				<ProseSkeleton />
			</MerchantSurfacePanel>
		</SkeletonRegion>
	);
}

// ── Workspace (before the org shell mounts) ─────────────────────────────────

/** The sidebar's outline, from the merchant menu itself — every section and row the real sidebar can show. */
const MERCHANT_SIDEBAR_SKELETON_SHAPE: SidebarMenuSkeletonShape = sidebarMenuSkeletonShape(MERCHANT_SIDEBAR_MENU);
/** The merchant header's actions (MerchantTopbar): the store switcher, then notifications. */
const MERCHANT_HEADER_ACTIONS: readonly AppShellHeaderSkeletonAction[] = ["button", "icon"];

export interface MerchantWorkspaceSkeletonProps {
	/** The member's saved sidebar state (its cookie), so a collapsed sidebar stays collapsed while the workspace loads. */
	readonly sidebarOpen: boolean;
}

/**
 * The merchant shell itself while the workspace loads — the entry routes
 * (`/`, `/account`) that resolve the member's organization and redirect into
 * it, and the org layout's first render. It is the real `AppPanelShell` (frame,
 * sidebar width, page panel) with the real sidebar header; only what loads is
 * a placeholder: the menu (outlined from the merchant menu), the header's
 * breadcrumb and actions, and a dashboard-shaped page.
 */
export function MerchantWorkspaceSkeleton({ sidebarOpen }: MerchantWorkspaceSkeletonProps): React.JSX.Element {
	return (
		<AppPanelShell
			shellClassName="merchant-panel-shell"
			contentClassName="space-y-6"
			defaultSidebarOpen={sidebarOpen}
			sidebar={
				<PanelSidebarSkeleton
					data-slot="workspace-sidebar-skeleton"
					header={
						<PanelSidebarHeader
							title={MERCHANT_SIDEBAR_MENU.header.title}
							subtitle={MERCHANT_SIDEBAR_MENU.header.subtitle}
							icon={<BrandMark className="size-5 text-primary" />}
						/>
					}
					sections={MERCHANT_SIDEBAR_SKELETON_SHAPE.sections}
					footerRows={MERCHANT_SIDEBAR_SKELETON_SHAPE.footerRows}
				/>
			}
			topbar={<AppShellHeaderSkeleton actions={MERCHANT_HEADER_ACTIONS} />}>
			<MerchantDashboardPageSkeleton labels={MERCHANT_WORKSPACE_LOADING_LABELS} />
		</AppPanelShell>
	);
}

// ── Organization dashboard ───────────────────────────────────────────────────

/** `/orgs/[orgSlug]/dashboard`: the workspace hero, four stat cards, two columns of shortcuts and the tenant snapshot. */
export interface MerchantDashboardPageSkeletonProps {
	/** What the region announces — the dashboard's own load by default, or the whole workspace's. */
	readonly labels?: UiKitLabelsOverride<"skeletonRegion">;
}

export function MerchantDashboardPageSkeleton({ labels = MERCHANT_DASHBOARD_LOADING_LABELS }: MerchantDashboardPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className={PAGE_STACK}>
			<MerchantSurfacePanel className="overflow-hidden">
				<div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
					<div className="flex min-w-0 items-center gap-4">
						<Skeleton className="size-12 rounded-xl" />
						<div className="flex min-w-0 flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-40" />
							<Skeleton className="h-8 w-64 max-w-full" />
							<Skeleton variant="text" className="h-3 w-48" />
						</div>
					</div>
					<div className="flex gap-2">
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="h-5 w-20 rounded-full" />
					</div>
				</div>
				<div className="border-t border-border px-5 py-4 sm:px-6">
					<ProseSkeleton lines={DASHBOARD_HERO_NOTES} />
				</div>
			</MerchantSurfacePanel>
			<MerchantStatCardsSkeleton count={DASHBOARD_STAT_CARDS} className="sm:grid-cols-2 xl:grid-cols-4" />
			<div className="grid gap-6 lg:grid-cols-2">
				{placeholderKeys("column", DASHBOARD_LINK_COLUMNS).map((columnKey): React.JSX.Element => (
					<div key={columnKey} data-slot="dashboard-links-skeleton" className="flex flex-col gap-4">
						<MerchantHeadingSkeleton />
						<div className="flex flex-col gap-3">
							{placeholderKeys("link", DASHBOARD_LINKS_PER_COLUMN).map((key, index): React.JSX.Element => (
								<NavLinkCardSkeleton key={key} index={index} />
							))}
						</div>
					</div>
				))}
			</div>
			<MerchantSurfacePanel className="flex flex-col gap-3 p-5 sm:p-6">
				<Skeleton variant="text" className="h-4.5 w-36" />
				<div className="grid gap-3 sm:grid-cols-2">
					{placeholderKeys("fact", DASHBOARD_SNAPSHOT_FACTS).map((key, index): React.JSX.Element => (
						<div key={key} className="flex flex-col gap-1.5">
							<Skeleton variant="text" className="h-3.5 w-28" />
							<Skeleton variant="text" className={cn("h-3.5", cycledWidth(["w-56", "w-20", "w-28", "w-44"], index))} />
						</div>
					))}
				</div>
			</MerchantSurfacePanel>
		</SkeletonRegion>
	);
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/analytics`: header with export, range controls, the sales and reward KPI rows, four charts and three breakdowns. */
export function MerchantAnalyticsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_ANALYTICS_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton actions={1} />
			<div data-slot="analytics-range-skeleton" className="flex flex-wrap items-center gap-3">
				<Skeleton className="h-9 w-72 max-w-full" />
				<Skeleton className="h-9 w-48" />
			</div>
			<StatCardsSkeleton count={ANALYTICS_SALES_KPIS} columns={4} className="min-[420px]:grid-cols-2 lg:grid-cols-4" />
			<StatCardsSkeleton count={ANALYTICS_REWARD_KPIS} columns={3} className="min-[420px]:grid-cols-2 lg:grid-cols-3" />
			<div className="grid gap-6 xl:grid-cols-2">
				{placeholderKeys("chart", ANALYTICS_CHARTS).map((key): React.JSX.Element => (
					<ChartSkeleton key={key} withControls={false} />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				{placeholderKeys("breakdown", ANALYTICS_BREAKDOWNS).map((key): React.JSX.Element => (
					<ListSkeleton key={key} rows={ANALYTICS_BREAKDOWN_ROWS} leading="none" />
				))}
			</div>
		</SkeletonRegion>
	);
}

// ── API keys ─────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/api-keys`: header, the three key stats, the create-key card, the filtered key list and the integration guide. */
export function MerchantApiKeysPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_API_KEYS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantStatCardsSkeleton count={FLEET_STAT_CARDS} className="sm:grid-cols-3" />
			<MerchantSurfacePanel className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className="flex items-start gap-4">
					<Skeleton className="size-12 rounded-xl" />
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<MerchantHeadingSkeleton />
						<div className="flex flex-wrap gap-2">
							<Skeleton className="h-6 w-36 rounded-full" />
							<Skeleton className="h-6 w-32 rounded-full" />
							<Skeleton className="h-6 w-28 rounded-full" />
						</div>
					</div>
				</div>
				<div className="flex flex-col gap-3 rounded-lg border border-border p-4">
					<FormSkeleton surface="plain" fields={CREATE_KEY_FIELDS} withActions={false} />
					<Skeleton className="h-9 w-36 self-end" />
				</div>
			</MerchantSurfacePanel>
			<MerchantSectionCardSkeleton withHeaderAction>
				<MerchantGridRowsSkeleton rows={FLEET_SKELETON_ROWS} rowGridClassName={API_KEY_ROW_GRID} textCells={API_KEY_ROW_TEXT_CELLS} actions={API_KEY_ROW_ACTIONS} />
			</MerchantSectionCardSkeleton>
			<GuideCardSkeleton />
		</SkeletonRegion>
	);
}

// ── Terminals ────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/terminals`: header with "Add terminal", the three till stats, the till list, the security policy card and the pairing guide. */
export function MerchantTerminalsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_TERMINALS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton actions={1} />
			<MerchantStatCardsSkeleton count={FLEET_STAT_CARDS} className="sm:grid-cols-3" />
			<MerchantSectionCardSkeleton>
				<MerchantGridRowsSkeleton rows={FLEET_SKELETON_ROWS} rowGridClassName={TERMINAL_ROW_GRID} textCells={TERMINAL_ROW_TEXT_CELLS} actions={TERMINAL_ROW_ACTIONS} />
			</MerchantSectionCardSkeleton>
			<MerchantSectionCardSkeleton>
				<div className="px-5 py-4">
					<TerminalSettingsRowSkeleton />
				</div>
			</MerchantSectionCardSkeleton>
			<GuideCardSkeleton />
		</SkeletonRegion>
	);
}

// ── Redemptions ──────────────────────────────────────────────────────────────

/** A page of the redemption log: one panel per redemption — reward, terminal and method, then the time. Bones only. */
export function RedemptionRowsSkeleton(): React.JSX.Element {
	return <MerchantBorderedRowsSkeleton rows={REDEMPTION_SKELETON_ROWS} lines={1} trailing="text" surface="panel" />;
}

/** `/orgs/[orgSlug]/redemptions`: header, the "showing" and "today" stats, then the log. */
export function MerchantRedemptionsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_REDEMPTIONS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantStatCardsSkeleton count={REDEMPTION_STAT_CARDS} className="sm:grid-cols-2" />
			<RedemptionRowsSkeleton />
		</SkeletonRegion>
	);
}

// ── Rewards ──────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/rewards`: header with "New reward", the summary strip, the status tabs with the layout switch, and the reward grid. */
export function MerchantRewardsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_REWARDS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton actions={1} />
			<MerchantRewardsSummaryStripSkeleton />
			<MerchantRewardsCatalogSkeleton viewMode="grid" />
		</SkeletonRegion>
	);
}

/** Which reward page the editor skeleton stands in for. */
export type MerchantRewardEditorMode = "create" | "edit";

export interface MerchantRewardEditorPageSkeletonProps {
	readonly mode: MerchantRewardEditorMode;
}

/** A form card of the editor: its title and description, then label-over-input fields. */
function RewardFormCardSkeleton({ fields, columns }: { readonly fields: number; readonly columns: 1 | 2 }): React.JSX.Element {
	return <FormSkeleton fields={fields} columns={columns} withActions={false} className="border-border/80 shadow-xs" />;
}

/**
 * `/rewards/new` and `/rewards/[rewardId]/edit`: the back button and title,
 * the reward-type picker, the "Basic information" and "Limits & duration"
 * cards, then — creating — store availability and the draft switch, or —
 * editing — the performance card; and the action row.
 */
export function MerchantRewardEditorPageSkeleton({ mode }: MerchantRewardEditorPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={mode === "create" ? MERCHANT_REWARD_EDITOR_LOADING_LABELS : MERCHANT_REWARD_LOADING_LABELS} className="flex flex-col gap-6">
			<div className="mb-2 flex flex-wrap items-center gap-4">
				<Skeleton className="size-9 rounded-md" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-8 w-48" />
					<Skeleton variant="text" className="h-4 w-64 max-w-full" />
				</div>
				{mode === "edit" ? <Skeleton className="h-5 w-20 rounded-full" /> : null}
			</div>
			<Card className="border-border/80 shadow-xs">
				<CardHeader>
					<MerchantHeadingSkeleton />
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						{placeholderKeys("type", REWARD_TYPE_TILES).map((key): React.JSX.Element => (
							<Skeleton key={key} data-slot="reward-type-skeleton" className="h-20 rounded-lg" />
						))}
					</div>
				</CardContent>
			</Card>
			<RewardFormCardSkeleton fields={REWARD_BASIC_FIELDS} columns={1} />
			<RewardFormCardSkeleton fields={REWARD_LIMIT_FIELDS} columns={2} />
			{mode === "create" ? (
				<>
					<Card data-slot="reward-stores-skeleton" className="border-border/80 shadow-xs">
						<CardHeader>
							<MerchantHeadingSkeleton />
						</CardHeader>
						<CardContent className="grid gap-3 sm:grid-cols-2">
							{placeholderKeys("store", REWARD_STORE_OPTIONS).map((key): React.JSX.Element => (
								<Skeleton key={key} className="h-14 rounded-lg" />
							))}
						</CardContent>
					</Card>
					<Card className="border-border/80 shadow-xs">
						<CardContent className="flex items-center gap-3 p-6">
							<Skeleton variant="circular" className="h-5 w-9" />
							<div className="flex flex-col gap-2">
								<Skeleton variant="text" className="h-4 w-28" />
								<Skeleton variant="text" className="h-3.5 w-56" />
							</div>
						</CardContent>
					</Card>
				</>
			) : (
				<Card data-slot="reward-performance-skeleton" className="border-border/80 shadow-xs">
					<CardHeader>
						<MerchantHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<div className="grid gap-4 sm:grid-cols-3">
							{placeholderKeys("tile", REWARD_PERFORMANCE_TILES).map((key): React.JSX.Element => (
								<div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-4">
									<Skeleton variant="text" className="h-3 w-24" />
									<Skeleton className="h-7 w-16" />
								</div>
							))}
						</div>
						<Skeleton className="h-2 w-full rounded-full" />
					</CardContent>
				</Card>
			)}
			<div className="flex flex-wrap items-center justify-end gap-4">
				<Skeleton className="h-9 w-20" />
				<Skeleton className="h-9 w-36" />
			</div>
		</SkeletonRegion>
	);
}

// ── Settings ─────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/settings`: the header, one link card per settings area, and the pointer to Account. */
export function MerchantSettingsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_SETTINGS_LOADING_LABELS} className={PAGE_STACK}>
			<PageHeaderSkeleton />
			{placeholderKeys("setting", SETTINGS_LINK_CARDS).map((key): React.JSX.Element => (
				<div key={key} data-slot="settings-link-skeleton" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
					<MerchantHeadingSkeleton />
					<Skeleton className="h-9 w-36 shrink-0" />
				</div>
			))}
			<Skeleton variant="text" className="h-3.5 w-96 max-w-full" />
		</SkeletonRegion>
	);
}

/** The store-location list: the summary panel, then the two-column grid of location cards. Bones only. */
export function OrganizationLocationsSkeleton(): React.JSX.Element {
	return (
		<>
			<MerchantSurfacePanel className="flex flex-col gap-3 p-5 sm:p-6">
				<Skeleton variant="text" className="h-3.5 w-full max-w-xl" />
				<Skeleton variant="text" className="h-3.5 w-64" />
			</MerchantSurfacePanel>
			<div className="grid gap-4 md:grid-cols-2">
				{placeholderKeys("location", LOCATION_SKELETON_CARDS).map((key, index): React.JSX.Element => (
					<MerchantSurfacePanel key={key} className="flex flex-col gap-4 p-5">
						<div data-slot="location-card-skeleton" className="flex items-start justify-between gap-3">
							<div className="flex min-w-0 items-start gap-3">
								<Skeleton className="size-10 rounded-lg" />
								<div className="flex min-w-0 flex-col gap-2">
									<Skeleton variant="text" className={cn("h-4", cycledWidth(["w-36", "w-28", "w-40"], index))} />
									<Skeleton variant="text" className="h-3 w-20" />
								</div>
							</div>
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-4/5" />
							<Skeleton variant="text" className="h-3.5 w-1/3" />
						</div>
					</MerchantSurfacePanel>
				))}
			</div>
		</>
	);
}

/** `/orgs/[orgSlug]/settings/locations`: header with "Add store", the summary and the location cards. */
export function MerchantLocationsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_LOCATIONS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton actions={1} />
			<OrganizationLocationsSkeleton />
		</SkeletonRegion>
	);
}

/** The store-logo panel: its heading, then the logo tile beside its controls and the limits. */
export function StoreLogoSkeleton(): React.JSX.Element {
	return (
		<MerchantSurfacePanel className="flex flex-col gap-4 p-5 sm:p-6">
			<div className="flex flex-col gap-1.5">
				<Skeleton variant="text" className="h-4.5 w-24" />
				<Skeleton variant="text" className="h-4 w-80 max-w-full" />
			</div>
			<div className="flex items-center gap-4" data-slot="store-logo-skeleton">
				<Skeleton className="size-16 rounded-xl" />
				<div className="flex flex-col gap-2">
					<Skeleton className="h-8 w-32" />
					<Skeleton variant="text" className="h-3 w-72 max-w-full" />
				</div>
			</div>
		</MerchantSurfacePanel>
	);
}

/** `/orgs/[orgSlug]/settings/branding`: header and the store-logo panel. */
export function MerchantBrandingPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_BRANDING_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<StoreLogoSkeleton />
		</SkeletonRegion>
	);
}

/** A roster panel's title row: the heading and its count badge. */
function RosterHeadingSkeleton(): React.JSX.Element {
	return (
		<div className="flex items-center justify-between gap-3">
			<Skeleton variant="text" className="h-4.5 w-40" />
			<Skeleton className="h-5 w-8 rounded-full" />
		</div>
	);
}

/** `/orgs/[orgSlug]/settings/team`: header, current members, pending invitations and the invite form. */
export function MerchantTeamPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_TEAM_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantSurfacePanel className="flex flex-col gap-4 p-6">
				<RosterHeadingSkeleton />
				<MerchantBorderedRowsSkeleton rows={TEAM_MEMBER_SKELETON_ROWS} lines={TEAM_MEMBER_LINES} trailing="badge" surface="card" />
			</MerchantSurfacePanel>
			<MerchantSurfacePanel className="flex flex-col gap-4 p-6">
				<RosterHeadingSkeleton />
				<MerchantBorderedRowsSkeleton rows={TEAM_INVITE_SKELETON_ROWS} lines={TEAM_INVITE_LINES} trailing="button" surface="card" />
			</MerchantSurfacePanel>
			<MerchantSurfacePanel className="flex flex-col gap-6 p-6">
				<Skeleton variant="text" className="h-4.5 w-48" />
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
					<FormSkeleton surface="plain" fields={1} withActions={false} />
					<FormSkeleton surface="plain" fields={1} withActions={false} />
				</div>
				<Skeleton className="h-28 w-full rounded-xl" />
				<Skeleton className="h-9 w-36" />
			</MerchantSurfacePanel>
		</SkeletonRegion>
	);
}

/** The verification form section alone — what the page's capability gate draws while the membership resolves. */
export function MerchantKybVerificationSectionSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_VERIFICATION_LOADING_LABELS}>
			<MerchantKybVerificationSkeleton />
		</SkeletonRegion>
	);
}

/** `/orgs/[orgSlug]/settings/verification`: header, the pointer to Account, and the verification form. */
export function MerchantVerificationPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_VERIFICATION_LOADING_LABELS} className={PAGE_STACK}>
			<PageHeaderSkeleton />
			<Skeleton variant="text" className="h-3.5 w-96 max-w-full" />
			<MerchantKybVerificationSkeleton />
		</SkeletonRegion>
	);
}

// ── Account ──────────────────────────────────────────────────────────────────

/** `/orgs/[orgSlug]/account`: header, then the security panel's sections. */
export function MerchantAccountPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_ACCOUNT_LOADING_LABELS} className={PAGE_STACK}>
			<PageHeaderSkeleton />
			<SecuritySettingsPanelSkeleton />
		</SkeletonRegion>
	);
}
