"use client";

import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import * as React from "react";

import { useSidebarControl } from "@/hooks/use-sidebar-control";

import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { MobileMenuOverlay } from "@/components/layout/mobile-menu-overlay";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ScrollToTop } from "@/components/common/scroll-to-top";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { FooterAction, SidebarUser } from "@/types/sidebar";
import { useMediaQuery } from "@/hooks/use-media-query";

export interface DashboardLayoutProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
}

const DESKTOP_SIDEBAR_WIDTH = 280;

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

	return (
		<BreadcrumbTrail
			items={status.kind === "ready" ? status.items : []}
			status={status.kind}
			errorMessage={status.kind === "error" ? status.message : undefined}
			maxItems={maxItems}
			renderLink={renderLink}
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
	const isOpen = useSidebarStore((s) => s.isOpen);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

	const handleCloseMobileMenu = React.useCallback((): void => {
		setIsMobileMenuOpen(false);
	}, []);

	return (
		<div className={cn("flex h-svh w-full overflow-hidden bg-background")}>
			{/* Desktop sidebar with animated width */}
			<motion.aside
				initial={false}
				animate={{ width: isOpen ? DESKTOP_SIDEBAR_WIDTH : 0 }}
				transition={{ type: "tween", duration: 0.2, ease: "easeInOut" }}
				className="hidden shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar lg:block"
				aria-hidden={!isOpen}>
				<div className="h-full w-[280px]">
					<Sidebar user={user} onLogout={onLogout} isMobileMenuOpen={false} setIsMobileMenuOpen={handleCloseMobileMenu} footerActions={footerActions} />
				</div>
			</motion.aside>

			{/* Mobile drawer */}
			<MobileMenuOverlay open={isMobileMenuOpen} onClose={handleCloseMobileMenu}>
				<Sidebar user={user} onLogout={onLogout} isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} footerActions={footerActions} />
			</MobileMenuOverlay>

			{/* Main column */}
			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar user={user} onLogout={onLogout} setIsMobileMenuOpen={setIsMobileMenuOpen} />
				<main className="flex-1 overflow-y-auto">
					<div className="px-6 pt-6 pb-6">
						<ShellBreadcrumb />
						{children}
					</div>
				</main>
			</div>

			<ScrollToTop threshold={300} />
		</div>
	);
}
