"use client";

import { SidebarContent, SidebarFooter, SidebarGroup, SidebarMenu } from "@workspace/ui/components/sidebar-parts";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { cva } from "class-variance-authority";
import * as React from "react";

/*
 * The panel shell (`AppPanelShell`) while an app's whole workspace loads. Each
 * part is built from the same primitives and spacing as the real thing —
 * `PanelSidebarSearch`, `PanelSidebarSectionHeader`, the nav rows
 * (`panelSidebarNavItemVariants`), `AppShellSidebarAccount` and
 * `AppShellHeader` — so every bone sits exactly where its item will appear.
 * Render them inside a real `AppPanelShell`, so the frame, the sidebar's width
 * and the floating page panel are the real ones too. Bones only, hidden from
 * assistive tech: the page's `SkeletonRegion` announces the load.
 */

/** Section labels are one or two short words. */
const SECTION_LABEL_WIDTHS: readonly string[] = ["w-16", "w-12", "w-20", "w-14"];
/** Nav labels: one to three words, so neighbours never share a width. */
const NAV_LABEL_WIDTHS: readonly string[] = ["w-28", "w-20", "w-24", "w-16", "w-32", "w-20"];

/** Each section starts further along the label widths, so sections don't repeat the same outline. */
const SECTION_WIDTH_SHIFT = 2;

/** One nav row: the 16pt icon and the label, at the real row's height (`py-2` around a `text-sm` line) and inset (`px-3`). */
function NavRowSkeleton({ index }: { readonly index: number }): React.JSX.Element {
	return (
		<li className="flex h-9 items-center gap-2 px-3">
			<Skeleton className="size-4 rounded-[5px]" />
			<Skeleton variant="text" className={cn("h-3", cycledWidth(NAV_LABEL_WIDTHS, index))} />
		</li>
	);
}

export interface PanelSidebarSkeletonProps extends React.ComponentProps<"div"> {
	/** The app's real `PanelSidebarHeader` — the brand never loads, so it is never a placeholder. */
	readonly header: React.ReactNode;
	/** Rows per menu section, in order — derive them from the app's menu so the outline matches it. */
	readonly sections: readonly number[];
	/** Rows in the footer menu above the account (e.g. Account, Help). */
	readonly footerRows: number;
}

/** The panel sidebar's outline: the real header, the search field, each section's label and rows, and the footer's rows and account. */
export const PanelSidebarSkeleton = React.forwardRef<HTMLDivElement, PanelSidebarSkeletonProps>(function PanelSidebarSkeleton(
	{ header, sections, footerRows, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="panel-sidebar-skeleton" className={cn("flex h-full min-h-0 flex-col overflow-hidden text-sidebar-foreground", className)} {...props}>
			{header}
			<SidebarContent aria-hidden="true" className="[overflow-anchor:none]">
				<div className="p-3">
					<Skeleton className="h-9 w-full rounded-lg" />
				</div>
				{sections.map((rows, sectionIndex) => (
					<SidebarGroup key={`section-${String(sectionIndex)}`}>
						{/* The real label row is as tall as its (hover-only) reorder buttons: 28pt. */}
						<div className="mb-2 flex h-7 items-center gap-1.5 px-2">
							<Skeleton variant="circular" className="size-1.5" />
							<Skeleton variant="text" className={cn("h-2.5", cycledWidth(SECTION_LABEL_WIDTHS, sectionIndex))} />
						</div>
						<SidebarMenu className="gap-0.5">
							{placeholderKeys("row", rows).map((key, index) => (
								<NavRowSkeleton key={key} index={index + sectionIndex * SECTION_WIDTH_SHIFT} />
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter aria-hidden="true" className="shrink-0 border-t border-sidebar-border bg-sidebar-accent/10">
				{footerRows > 0 ? (
					<SidebarMenu className="gap-0.5">
						{placeholderKeys("footer-row", footerRows).map((key, index) => (
							<NavRowSkeleton key={key} index={index} />
						))}
					</SidebarMenu>
				) : null}
				<div className="flex items-center gap-1 px-1 py-1">
					<div className="flex min-w-0 flex-1 items-center gap-2.5 p-1">
						<Skeleton variant="circular" className="size-7" />
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<Skeleton variant="text" className="h-3 w-24" />
							<Skeleton variant="text" className="h-2.5 w-32" />
						</div>
					</div>
					<Skeleton className="size-6 rounded-md" />
					<Skeleton className="size-6 rounded-md" />
				</div>
			</SidebarFooter>
		</div>
	);
});
PanelSidebarSkeleton.displayName = "PanelSidebarSkeleton";

/** A header action's outline: a labelled control (a store switcher) or an icon button (notifications). */
const headerActionSkeletonVariants = cva("shrink-0 rounded-md", {
	variants: {
		kind: {
			button: "hidden h-8 w-36 sm:block",
			icon: "size-8",
		},
	},
});

export type AppShellHeaderSkeletonAction = "button" | "icon";

export interface AppShellHeaderSkeletonProps extends React.ComponentProps<"header"> {
	/** The app's header actions, in order — e.g. `["button", "icon"]` for a store switcher and notifications. */
	readonly actions?: readonly AppShellHeaderSkeletonAction[];
}

const NO_ACTIONS: readonly AppShellHeaderSkeletonAction[] = [];

/**
 * The page panel's header (`AppShellHeader`) outline: same height, padding and
 * edge, the sidebar toggle's slot (which the shell hides beside an open
 * sidebar), the breadcrumb, the app's actions and the search button.
 */
export const AppShellHeaderSkeleton = React.forwardRef<HTMLElement, AppShellHeaderSkeletonProps>(function AppShellHeaderSkeleton(
	{ actions = NO_ACTIONS, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<header
			ref={ref}
			aria-hidden="true"
			data-slot="app-shell-header-skeleton"
			className={cn("flex h-14 shrink-0 items-center gap-2 border-b border-border bg-shell-panel px-4 sm:px-6", className)}
			{...props}>
			<span data-slot="app-shell-header-toggle" className="flex shrink-0 overflow-hidden">
				<Skeleton className="size-7 rounded-md" />
			</span>
			<div className="min-w-0 flex-1">
				<Skeleton variant="text" className="h-3.5 w-36" />
			</div>
			{actions.length > 0 ? (
				<div className="flex shrink-0 items-center gap-2">
					{actions.map((kind, index) => (
						<Skeleton key={`action-${String(index)}`} className={headerActionSkeletonVariants({ kind })} />
					))}
				</div>
			) : null}
			<Skeleton className="h-8 w-9 shrink-0 rounded-md sm:w-28 md:w-36" />
		</header>
	);
});
AppShellHeaderSkeleton.displayName = "AppShellHeaderSkeleton";
