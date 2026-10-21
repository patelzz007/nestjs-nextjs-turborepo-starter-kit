"use client";

import { API_KEY_ROW_ACTIONS, API_KEY_ROW_GRID, API_KEY_ROW_TEXT_CELLS } from "@/contexts/pos/components/api-keys/api-key-row-grid";
import {
	MerchantBorderedRowsSkeleton,
	MerchantGridRowsSkeleton,
	MerchantHeadingSkeleton,
	MerchantPageHeaderSkeleton,
	MerchantSectionCardSkeleton,
	MerchantStatCardsSkeleton,
} from "@/components/loading/merchant-skeleton-parts";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { REWARD_EDITOR_GRID_CLASS } from "@/contexts/rewards/components/merchant-reward-editor-layout";
import { MerchantRewardsCatalogSkeleton } from "@/contexts/rewards/components/merchant-rewards-catalog";
import { MerchantRewardsSummaryStripSkeleton } from "@/contexts/rewards/components/merchant-rewards-summary-strip";
import { TERMINAL_ROW_ACTIONS, TERMINAL_ROW_GRID, TERMINAL_ROW_TEXT_CELLS } from "@/contexts/pos/components/terminals/terminal-row-grid";
import { TerminalSettingsRowSkeleton } from "@/contexts/pos/components/terminals/terminal-settings-card";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { sidebarMenuSkeletonShape, type SidebarMenuSkeletonShape } from "@workspace/client/lib/sidebar/sidebar-menu-skeleton";
import { AppPanelShell } from "@workspace/ui/components/app-panel-shell";
import { AppShellHeaderSkeleton, PanelSidebarSkeleton, PanelSidebarSwitcherSkeleton, type AppShellHeaderSkeletonAction } from "@workspace/ui/components/panel-shell-skeleton";
import { SecuritySettingsPanelSkeleton } from "@workspace/client/lib/contexts/identity/mfa/security-settings-panel-skeleton";
import { MerchantKybVerificationSkeleton } from "@workspace/client/lib/contexts/tenancy/kyb/verification-skeleton";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChartSkeleton, FormSkeleton, ListSkeleton, PageHeaderSkeleton, ProseSkeleton, StatCardsSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { Card } from "@workspace/ui/components/card";
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
export const MERCHANT_STORES_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading your stores…" };
export const MERCHANT_REWARD_EDITOR_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading reward editor…" };
export const MERCHANT_REWARD_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading reward…" };
export const MERCHANT_SETTINGS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading settings…" };
export const MERCHANT_LOCATIONS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading store locations…" };
export const MERCHANT_BRANDING_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading store branding…" };
export const MERCHANT_TEAM_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading team…" };
export const MERCHANT_BANNED_CUSTOMERS_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading banned customers…" };
export const MERCHANT_VERIFICATION_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading business verification…" };
export const MERCHANT_ACCOUNT_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading account…" };

// ── Counts (what a typical page holds; the real rows replace them) ───────────

/** Tenant dashboard KPI tiles: role, locations, KYB status, policy version. */
const DASHBOARD_STAT_CARDS = 4;
/** Shortcut links per dashboard column (administration, operations). */
const DASHBOARD_LINKS_PER_COLUMN = 3;
/** Dashboard columns of shortcut links. */
const DASHBOARD_LINK_COLUMNS = 2;
/** Notes under the dashboard hero ("You are here", "Merchant home"). */
const DASHBOARD_HERO_NOTES = 2;
/** Tenant-snapshot facts: tenant ID, membership status, location scope, merchant contact. */
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
/** Reward-type choices in the reward editor (one per reward type). */
const REWARD_TYPE_CHOICES = 5;
/** Sections the editor skeleton draws: the offer, its photos, and when and how many. */
export const REWARD_EDITOR_SKELETON_SECTIONS = 3;
/** Paired fields in the editor's offer and schedule sections (value and minimum spend; start, end, stock, per customer). */
const REWARD_OFFER_PAIRED_FIELDS = 2;
const REWARD_SCHEDULE_FIELDS = 4;
/** Facts in the reward page's details list: runs, per customer, minimum spend, stores, category. */
const REWARD_DETAIL_ROWS = 5;
/** Counts in the reward page's performance row: claimed, redeemed (stock is drawn as a meter). */
const REWARD_PERFORMANCE_COUNTS = 2;
/** Tenant-settings link cards: team, locations, verification. */
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
export function GuideCardSkeleton(): React.JSX.Element {
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
			<Card className="gap-0 p-6">
				<ProseSkeleton />
			</Card>
		</SkeletonRegion>
	);
}

// ── Workspace (before the tenant shell mounts) ─────────────────────────────────

/** The sidebar's outline, from the merchant menu itself — every section and row the real sidebar can show. */
const MERCHANT_SIDEBAR_SKELETON_SHAPE: SidebarMenuSkeletonShape = sidebarMenuSkeletonShape(MERCHANT_SIDEBAR_MENU);
/** The merchant header's actions (MerchantTopbar): notifications. The store and location switcher heads the sidebar. */
const MERCHANT_HEADER_ACTIONS: readonly AppShellHeaderSkeletonAction[] = ["icon"];

export interface MerchantWorkspaceSkeletonProps {
	/** The member's saved sidebar state (its cookie), so a collapsed sidebar stays collapsed while the workspace loads. */
	readonly sidebarOpen: boolean;
}

/**
 * The merchant shell itself while the workspace loads — the entry routes
 * (`/`, `/account`) that resolve the member's tenant and redirect into
 * it, and the tenant layout's first render. It is the real `AppPanelShell` (frame,
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
					header={<PanelSidebarSwitcherSkeleton />}
					sections={MERCHANT_SIDEBAR_SKELETON_SHAPE.sections}
					footerRows={MERCHANT_SIDEBAR_SKELETON_SHAPE.footerRows}
				/>
			}
			topbar={<AppShellHeaderSkeleton actions={MERCHANT_HEADER_ACTIONS} />}>
			<MerchantDashboardPageSkeleton labels={MERCHANT_WORKSPACE_LOADING_LABELS} />
		</AppPanelShell>
	);
}

// ── Tenant dashboard ───────────────────────────────────────────────────

/** `/t/[tenantSlug]/dashboard`: the workspace hero, four stat cards, two columns of shortcuts and the tenant snapshot. */
export interface MerchantDashboardPageSkeletonProps {
	/** What the region announces — the dashboard's own load by default, or the whole workspace's. */
	readonly labels?: UiKitLabelsOverride<"skeletonRegion">;
}

export function MerchantDashboardPageSkeleton({ labels = MERCHANT_DASHBOARD_LOADING_LABELS }: MerchantDashboardPageSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className={PAGE_STACK}>
			<Card className="gap-0 overflow-hidden py-0">
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
			</Card>
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
			<Card className="gap-3 p-5 sm:p-6">
				<Skeleton variant="text" className="h-4.5 w-36" />
				<div className="grid gap-3 sm:grid-cols-2">
					{placeholderKeys("fact", DASHBOARD_SNAPSHOT_FACTS).map((key, index): React.JSX.Element => (
						<div key={key} className="flex flex-col gap-1.5">
							<Skeleton variant="text" className="h-3.5 w-28" />
							<Skeleton variant="text" className={cn("h-3.5", cycledWidth(["w-56", "w-20", "w-28", "w-44"], index))} />
						</div>
					))}
				</div>
			</Card>
		</SkeletonRegion>
	);
}

// ── Analytics ────────────────────────────────────────────────────────────────

/** `/t/[tenantSlug]/analytics`: header with export, range controls, the sales and reward KPI rows, four charts and three breakdowns. */
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

/** `/t/[tenantSlug]/api-keys`: header, the three key stats, the create-key card, the filtered key list and the integration guide. */
export function MerchantApiKeysPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_API_KEYS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantStatCardsSkeleton count={FLEET_STAT_CARDS} className="sm:grid-cols-3" />
			<Card className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
			</Card>
			<MerchantSectionCardSkeleton withHeaderAction>
				<MerchantGridRowsSkeleton rows={FLEET_SKELETON_ROWS} rowGridClassName={API_KEY_ROW_GRID} textCells={API_KEY_ROW_TEXT_CELLS} actions={API_KEY_ROW_ACTIONS} />
			</MerchantSectionCardSkeleton>
			<GuideCardSkeleton />
		</SkeletonRegion>
	);
}

// ── Terminals ────────────────────────────────────────────────────────────────

/** `/t/[tenantSlug]/terminals`: header with "Add terminal", the three till stats, the till list, the security policy card and the pairing guide. */
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

/** `/t/[tenantSlug]/redemptions`: header, the "showing" and "today" stats, then the log. */
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

/** `/t/[tenantSlug]/rewards`: header with "New reward", the summary strip, the status tabs with the layout switch, and the reward grid. */
export function MerchantRewardsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_REWARDS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton actions={1} />
			<MerchantRewardsSummaryStripSkeleton />
			<MerchantRewardsCatalogSkeleton viewMode="grid" />
		</SkeletonRegion>
	);
}

/** One field: its label over its input. */
function RewardFieldSkeleton({ tall = false }: { readonly tall?: boolean }): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<Skeleton variant="text" className="h-3.5 w-24" />
			<Skeleton className={cn("w-full rounded-md", tall ? "h-20" : "h-9")} />
		</div>
	);
}

/** One section of the editor panel: its heading and line, then its body. */
function RewardEditorSectionSkeleton({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div data-slot="reward-editor-section-skeleton" className="flex flex-col gap-5 border-border px-5 py-6 not-first:border-t sm:px-7 sm:py-7">
			<MerchantHeadingSkeleton />
			{children}
		</div>
	);
}

/** A voucher's silhouette: the 16:9 cover, the offer and title, the tear line and the stub. */
function RewardVoucherSkeleton(): React.JSX.Element {
	return (
		<div data-slot="reward-voucher-skeleton" className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
			<Skeleton className="aspect-video w-full rounded-none" />
			<div className="flex flex-col gap-3 px-5 pt-4 pb-5">
				<Skeleton variant="text" className="h-3 w-16" />
				<Skeleton className="h-7 w-28" />
				<Skeleton variant="text" className="h-4 w-44" />
			</div>
			<div className="flex flex-col gap-3 border-t border-dashed border-border px-5 py-4">
				<Skeleton className="h-1.5 w-full rounded-full" />
				<Skeleton variant="text" className="h-3 w-32" />
			</div>
		</div>
	);
}

/**
 * `/rewards/new` and `/rewards/[rewardId]/edit`: the way back and the title,
 * then the form panel (the offer, photos, schedule and terms sections) beside
 * the preview column (the voucher, the checklist and the save buttons).
 */
export function MerchantRewardEditorPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_REWARD_EDITOR_LOADING_LABELS} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Skeleton variant="text" className="h-4 w-20" />
				<Skeleton className="h-8 w-48" />
				<Skeleton variant="text" className="h-4 w-80 max-w-full" />
			</div>
			<div className={REWARD_EDITOR_GRID_CLASS}>
				<Card className="min-w-0 gap-0 py-0">
					<RewardEditorSectionSkeleton>
						<div className="flex flex-wrap gap-2">
							{placeholderKeys("type", REWARD_TYPE_CHOICES).map((key, index): React.JSX.Element => (
								<Skeleton key={key} data-slot="reward-type-skeleton" className={cn("h-11 rounded-lg", cycledWidth(["w-32", "w-28", "w-32", "w-36", "w-40"], index))} />
							))}
						</div>
						<div className="grid gap-5 sm:grid-cols-2">
							{placeholderKeys("offer", REWARD_OFFER_PAIRED_FIELDS).map((key): React.JSX.Element => (
								<RewardFieldSkeleton key={key} />
							))}
						</div>
						<RewardFieldSkeleton />
						<RewardFieldSkeleton tall />
					</RewardEditorSectionSkeleton>
					<RewardEditorSectionSkeleton>
						<Skeleton className="aspect-video w-full rounded-lg sm:w-1/2 lg:w-1/3" />
					</RewardEditorSectionSkeleton>
					<RewardEditorSectionSkeleton>
						<div className="grid gap-5 sm:grid-cols-2">
							{placeholderKeys("schedule", REWARD_SCHEDULE_FIELDS).map((key): React.JSX.Element => (
								<RewardFieldSkeleton key={key} />
							))}
						</div>
					</RewardEditorSectionSkeleton>
				</Card>
				<div data-slot="reward-preview-skeleton" className="flex flex-col gap-4">
					<Skeleton variant="text" className="h-4 w-36" />
					<RewardVoucherSkeleton />
					<Skeleton className="h-20 w-full rounded-xl" />
					<div className="grid grid-cols-2 gap-2">
						<Skeleton className="h-9" />
						<Skeleton className="h-9" />
					</div>
				</div>
			</div>
		</SkeletonRegion>
	);
}

/**
 * `/rewards/[rewardId]`: the way back, the gallery beside the offer, title and
 * actions, the performance row, then the details list beside the terms.
 */
export function MerchantRewardDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_REWARD_LOADING_LABELS} className={PAGE_STACK}>
			<Skeleton variant="text" className="h-4 w-20" />
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
				<Skeleton className="aspect-video w-full rounded-xl" />
				<div className="flex flex-col gap-5 lg:pt-2">
					<Skeleton className="h-5 w-24 rounded-full" />
					<div className="flex flex-col gap-3">
						<Skeleton className="h-11 w-48" />
						<Skeleton className="h-7 w-64 max-w-full" />
						<Skeleton variant="text" className="h-4 w-full" />
						<Skeleton variant="text" className="h-4 w-3/4" />
					</div>
					<Skeleton className="h-9 w-36" />
				</div>
			</div>
			<div data-slot="reward-performance-skeleton" className="flex flex-col gap-3">
				<Skeleton variant="text" className="h-4 w-28" />
				<Card className="grid gap-0 divide-y divide-border py-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] sm:divide-x sm:divide-y-0">
					{placeholderKeys("count", REWARD_PERFORMANCE_COUNTS).map((key): React.JSX.Element => (
						<div key={key} className="flex flex-col gap-2 px-5 py-4 sm:px-6">
							<Skeleton className="h-7 w-14" />
							<Skeleton variant="text" className="h-3.5 w-20" />
						</div>
					))}
					<div className="flex flex-col justify-center gap-2 px-5 py-4 sm:px-6">
						<Skeleton variant="text" className="h-3 w-24" />
						<Skeleton className="h-1.5 w-full rounded-full" />
					</div>
				</Card>
			</div>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-3">
					<Skeleton variant="text" className="h-4 w-20" />
					<Card className="gap-0 divide-y divide-border px-5 py-2 sm:px-6">
						{placeholderKeys("detail", REWARD_DETAIL_ROWS).map((key, index): React.JSX.Element => (
							<div key={key} className="flex gap-4 py-3">
								<Skeleton variant="text" className="h-4 w-28" />
								<Skeleton variant="text" className={cn("h-4", cycledWidth(["w-40", "w-24", "w-32"], index))} />
							</div>
						))}
					</Card>
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton variant="text" className="h-4 w-40" />
					<Card className="gap-2 px-5 py-4 sm:px-6">
						<Skeleton variant="text" className="h-4 w-full" />
						<Skeleton variant="text" className="h-4 w-2/3" />
					</Card>
				</div>
			</div>
		</SkeletonRegion>
	);
}

// ── Settings ─────────────────────────────────────────────────────────────────

/** `/t/[tenantSlug]/settings`: the header, one link card per settings area, and the pointer to Account. */
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
export function LocationsSkeleton(): React.JSX.Element {
	return (
		<>
			<Card className="gap-3 p-5 sm:p-6">
				<Skeleton variant="text" className="h-3.5 w-full max-w-xl" />
				<Skeleton variant="text" className="h-3.5 w-64" />
			</Card>
			<div className="grid gap-4 md:grid-cols-2">
				{placeholderKeys("location", LOCATION_SKELETON_CARDS).map((key, index): React.JSX.Element => (
					<Card key={key} className="gap-4 p-5">
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
					</Card>
				))}
			</div>
		</>
	);
}

/** `/t/[tenantSlug]/settings/locations`: header with "Add store", the summary and the location cards. */
export function MerchantLocationsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_LOCATIONS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton actions={1} />
			<LocationsSkeleton />
		</SkeletonRegion>
	);
}

/** The store-logo panel: its heading, then the logo tile beside its controls and the limits. */
export function StoreLogoSkeleton(): React.JSX.Element {
	return (
		<Card className="gap-4 p-5 sm:p-6">
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
		</Card>
	);
}

/** `/t/[tenantSlug]/settings/branding`: header and the store-logo panel. */
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

/** `/t/[tenantSlug]/settings/team`: header, current members, pending invitations and the invite form. */
/** Store rows drawn while the stores page loads. */
export const STORE_ROW_SKELETON_ROWS = 4;
/** Lines of one store row: its name and the member's role. */
export const STORE_ROW_LINES = 2;

/** `/t/[tenantSlug]/stores`: the header, the search box and the store rows. */
export function MerchantStoresPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_STORES_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<Skeleton className="h-9 w-full max-w-sm rounded-md" />
			<MerchantBorderedRowsSkeleton rows={STORE_ROW_SKELETON_ROWS} lines={STORE_ROW_LINES} trailing="badge" surface="card" />
		</SkeletonRegion>
	);
}

export function MerchantTeamPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_TEAM_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<Card className="gap-4 p-6">
				<RosterHeadingSkeleton />
				<MerchantBorderedRowsSkeleton rows={TEAM_MEMBER_SKELETON_ROWS} lines={TEAM_MEMBER_LINES} trailing="badge" surface="card" />
			</Card>
			<Card className="gap-4 p-6">
				<RosterHeadingSkeleton />
				<MerchantBorderedRowsSkeleton rows={TEAM_INVITE_SKELETON_ROWS} lines={TEAM_INVITE_LINES} trailing="button" surface="card" />
			</Card>
			<Card className="gap-6 p-6">
				<Skeleton variant="text" className="h-4.5 w-48" />
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
					<FormSkeleton surface="plain" fields={1} withActions={false} />
					<FormSkeleton surface="plain" fields={1} withActions={false} />
				</div>
				<Skeleton className="h-28 w-full rounded-xl" />
				<Skeleton className="h-9 w-36" />
			</Card>
		</SkeletonRegion>
	);
}

/** Rows the banned-customers list shows while loading. */
export const BANNED_CUSTOMER_SKELETON_ROWS = 3;
/** Lines of one ban row: the redemption it was made from, and the reason. */
export const BANNED_CUSTOMER_LINES = 2;

/** `/t/[tenantSlug]/settings/banned-customers`: the header, then the ban rows with their lift button. */
export function MerchantBannedCustomersPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_BANNED_CUSTOMERS_LOADING_LABELS} className={PAGE_STACK}>
			<MerchantPageHeaderSkeleton />
			<MerchantBorderedRowsSkeleton rows={BANNED_CUSTOMER_SKELETON_ROWS} lines={BANNED_CUSTOMER_LINES} trailing="button" surface="card" />
		</SkeletonRegion>
	);
}

/** The ban rows alone — what the page draws below its real header while the list loads. */
export function BannedCustomerRowsSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_BANNED_CUSTOMERS_LOADING_LABELS}>
			<MerchantBorderedRowsSkeleton rows={BANNED_CUSTOMER_SKELETON_ROWS} lines={BANNED_CUSTOMER_LINES} trailing="button" surface="card" />
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

/** `/t/[tenantSlug]/settings/verification`: header, the pointer to Account, and the verification form. */
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

/** `/t/[tenantSlug]/account`: header, then the security panel's sections. */
export function MerchantAccountPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_ACCOUNT_LOADING_LABELS} className={PAGE_STACK}>
			<PageHeaderSkeleton />
			<SecuritySettingsPanelSkeleton />
		</SkeletonRegion>
	);
}
