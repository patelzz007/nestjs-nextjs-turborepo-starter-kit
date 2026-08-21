"use client";

import { motion, MotionConfig } from "framer-motion";

import { BreadcrumbTrail } from "@workspace/ui/components/navigation/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useSidebarControl } from "@/components/layout/use-sidebar-control";
import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { buildSidebarView } from "@/lib/navigation/menu";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import {
	SIDEBAR_ASIDE_TRANSITION,
	SIDEBAR_CONTENT_CLOSE_TRANSITION,
	SIDEBAR_CONTENT_OPEN_TRANSITION,
	SIDEBAR_INNER_CLASS,
	DESKTOP_SIDEBAR_WIDTH,
} from "@/components/layout/layout-motion";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { MobileMenuOverlay } from "@/components/layout/mobile-menu-overlay";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ScrollToTop } from "@workspace/ui/components/navigation/scroll-to-top";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

export interface DashboardLayoutProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
}

/**
 * Keeps `document.title` in sync with the breadcrumb trail. Reads the trail
 * straight from the context value — it already changes on every navigation,
 * so the effect re-runs with a fresh status (no stale-closure risk, and no
 * need for the `subscribe` registry here).
 */
function useTrailDocumentTitle(): void {
	const { status } = useAdminBreadcrumb();

	React.useEffect(() => {
		const trail = status.kind === "ready" ? status.items : [];
		if (trail.length === 0) {
			return;
		}
		const lastItem = trail[trail.length - 1];
		if (lastItem !== undefined) {
			document.title = `${lastItem.label} — Admin`;
		}
	}, [status]);
}

/** Smart breadcrumb consumer: reads status from context, renders the shared dumb trail. */
function ShellBreadcrumb(): React.JSX.Element {
	const { status } = useAdminBreadcrumb();
	const isDesktop = useMediaQuery("(min-width: 1024px)");

	// Mobile shows a compact 2-crumb trail; desktop the full 4-crumb trail.
	const maxItems = isDesktop ? 4 : 2;

	const renderLink = React.useCallback((item: BreadcrumbItem): React.ReactElement => {
		return <Link href={item.href ?? "#"} />;
	}, []);

	// Copy feedback lives in the smart consumer (rule 10): the dumb trail only
	// reports the result via `onCopy`, this layer decides to toast it via the
	// app-global Toast & Toastr manager (mounted in the root layout).
	const handleCopy = React.useCallback((ok: boolean): void => {
		if (ok) {
			toastMessage.success({ title: "Link copied", description: "The page URL is on your clipboard." });
		} else {
			toastMessage.error({ title: "Could not copy link", description: "Copy the URL from the address bar instead." });
		}
	}, []);

	return (
		<BreadcrumbTrail
			items={status.kind === "ready" ? status.items : []}
			status={status.kind}
			errorMessage={status.kind === "error" ? status.message : undefined}
			maxItems={maxItems}
			renderLink={renderLink}
			onCopy={handleCopy}
		/>
	);
}

/**
 * The dashboard shell: animated desktop sidebar, mobile drawer, topbar,
 * breadcrumb, scroll-to-top button, and the page content.
 */
export function DashboardLayout({ user, onLogout, footerActions = [], children }: DashboardLayoutProps): React.JSX.Element {
	useSidebarControl();
	useTrailDocumentTitle();
	const router = useRouter();
	const isOpen = useSidebarStore((s) => s.isOpen);
	const sectionOrder = useSidebarStore((s) => s.sectionOrder);
	const searchQuery = useSidebarStore((s) => s.searchQuery);
	const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
	const clearSearch = useSidebarStore((s) => s.clearSearch);
	const storeExpandedItems = useSidebarStore((s) => s.expandedItems);
	const setItemExpanded = useSidebarStore((s) => s.setItemExpanded);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);
	const pathname = usePathname();
	const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

	const view = React.useMemo(
		() => buildSidebarView({ menu: SIDEBAR_MENU, pathname, sectionOrder, searchQuery, isHighlightParentItem: false }),
		[pathname, sectionOrder, searchQuery],
	);

	const expandedItems = React.useMemo(() => ({ ...storeExpandedItems, ...view.routeState.autoExpandedItems }), [storeExpandedItems, view.routeState.autoExpandedItems]);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setSearchQuery(event.target.value);
		},
		[setSearchQuery],
	);

	const handleClearSearch = React.useCallback((): void => {
		clearSearch();
	}, [clearSearch]);

	const handleToggleItem = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(itemId, !(expandedItems[itemId] ?? false));
		},
		[expandedItems, setItemExpanded],
	);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			router.push(href);
		},
		[router],
	);

	const sidebarProps = React.useMemo(
		() => ({
			user,
			onLogout,
			footerActions,
			view,
			labels: ADMIN_SIDEBAR_LABELS,
			searchQuery,
			onSearchChange: handleSearchChange,
			onClearSearch: handleClearSearch,
			expandedItems,
			onToggleItem: handleToggleItem,
			onNavigate: handleNavigate,
			onMoveSectionUp: moveSectionUp,
			onMoveSectionDown: moveSectionDown,
			navigationKey: pathname,
		}),
		[
			user,
			onLogout,
			footerActions,
			view,
			searchQuery,
			handleSearchChange,
			handleClearSearch,
			expandedItems,
			handleToggleItem,
			handleNavigate,
			moveSectionUp,
			moveSectionDown,
			pathname,
		],
	);

	// The sidebar store defers its localStorage rehydration (`skipHydration`)
	// so SSR + the first client render agree on the defaults — otherwise a
	// persisted collapsed sidebar would mismatch the server-rendered expanded
	// one. Kick off hydration once after mount so the user's saved preference
	// (sidebar width, section order) takes over immediately post-hydration.
	React.useEffect(() => {
		void useSidebarStore.persist.rehydrate();
	}, []);

	const handleCloseMobileMenu = React.useCallback((): void => {
		setIsMobileMenuOpen(false);
	}, []);
	return (
		<MotionConfig reducedMotion="user">
			{/* Skip link (audit #15): the sidebar precedes `main` in the DOM, so keyboard users would otherwise tab through the whole menu before reaching content. Visually hidden until focused. */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg">
				{ADMIN_SIDEBAR_LABELS.skipToContent}
			</a>
			<div className={cn("flex h-svh w-full overflow-hidden bg-background")}>
				{/* Desktop sidebar — animated width via framer-motion. `initial={false}` renders the `animate` values on SSR + the first client render (no entrance animation, no hydration mismatch); the tween only runs when `isOpen` changes afterwards. The inner content fades/slides in as the width reveals it (and fades out FIRST on collapse), so the reveal is a soft coordinated motion instead of a hard clip edge. `MotionConfig reducedMotion="user"` turns it into an instant snap for users who prefer reduced motion. */}
				<motion.aside
					aria-hidden={!isOpen}
					initial={false}
					animate={{ width: isOpen ? DESKTOP_SIDEBAR_WIDTH : 0 }}
					transition={SIDEBAR_ASIDE_TRANSITION}
					className="hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar lg:block">
					<motion.div
						initial={false}
						animate={{ opacity: isOpen ? 1 : 0, x: isOpen ? 0 : -12 }}
						transition={isOpen ? SIDEBAR_CONTENT_OPEN_TRANSITION : SIDEBAR_CONTENT_CLOSE_TRANSITION}
						// Single source of truth for the width — inline style from the
						// constant so the aside tween and the inner layout can't drift.
						style={{ width: DESKTOP_SIDEBAR_WIDTH }}
						className={SIDEBAR_INNER_CLASS}>
						<Sidebar {...sidebarProps} isMobileMenuOpen={false} setIsMobileMenuOpen={handleCloseMobileMenu} />
					</motion.div>
				</motion.aside>

				{/* Mobile drawer */}
				<MobileMenuOverlay open={isMobileMenuOpen} onClose={handleCloseMobileMenu}>
					<Sidebar {...sidebarProps} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
				</MobileMenuOverlay>

				{/* Main column */}
				<div className="flex min-w-0 flex-1 flex-col">
					<Topbar user={user} onLogout={onLogout} setIsMobileMenuOpen={setIsMobileMenuOpen} />
					{/* `overscroll-none` stops the macOS/Chrome rubber-band reveal: at the bottom of a
				    long page the elastic bounce exposes a blank band of the container background
				    (near-white in light mode), which reads as "unaccounted white space". The
				    dashboard scrolls entirely inside `main`, so nothing is lost by disabling it. */}{" "}
					<main id="main-content" className="flex-1 overflow-y-auto overscroll-none">
						{/* `pb-10`: content breathing room at the bottom of every page. The old
						    `pb-2` was a workaround for macOS rubber-band overscroll showing a
						    blank band — `overscroll-none` on `<main>` now stops that bounce, so a
						    generous bottom padding reads as intentional whitespace, not a bug. */}
						<div className="px-6 pt-6 pb-10">
							<ShellBreadcrumb />
							{children}
						</div>
						{/* Mounted INSIDE `main` so ScrollToTop's walk-up finds the real scroller
						    (`main` is overflow-y-auto; `window` never fires here). `fixed` keeps it
						    viewport-anchored — no ancestor transform exists on this path. */}
						<ScrollToTop threshold={300} />
					</main>
				</div>
			</div>
		</MotionConfig>
	);
}
