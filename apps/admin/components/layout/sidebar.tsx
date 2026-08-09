"use client";

import { LogOut, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { SIDEBAR_MENU } from "@/config/sidebar-menu";
import { getInitials } from "@/lib/user-initials";
import { sectionHasActiveItem, type SidebarView } from "@/lib/menu";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { FooterAction, SidebarUser } from "@/types/sidebar";

import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { SidebarSectionHeader } from "@/components/layout/sidebar-section-header";
export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly isMobileMenuOpen: boolean;
	readonly setIsMobileMenuOpen: (isOpen: boolean) => void;
	readonly footerActions?: readonly FooterAction[];
	/**
	 * The render model, computed ONCE in `DashboardLayout` and shared by the
	 * desktop + mobile instances (sidebar audit, improvement 20). The sidebar
	 * never computes route/search/order state itself.
	 */
	readonly view: SidebarView;
}

/** True when the keyboard event target is a text-entry element (don't hijack "/"). */
function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * The admin sidebar. All derived state (active route, search results, section
 * order) arrives via the `view` prop from `DashboardLayout` — this component is
 * a pure renderer over it. The nav tree lives in `config/sidebar-menu.json`,
 * sections can be reordered (persisted), the menu is searchable with match
 * highlighting, and manual expansions are persisted in the store (audit #6).
 */
export function Sidebar({ user, onLogout, isMobileMenuOpen, setIsMobileMenuOpen, footerActions = [], view }: SidebarProps): React.JSX.Element {
	const router = useRouter();
	const pathname = usePathname();
	const storeExpandedItems = useSidebarStore((s) => s.expandedItems);
	const setItemExpanded = useSidebarStore((s) => s.setItemExpanded);
	const searchQuery = useSidebarStore((s) => s.searchQuery);
	const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
	const clearSearch = useSidebarStore((s) => s.clearSearch);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);

	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const navContainerRef = React.useRef<HTMLDivElement>(null);

	/** Auto-expanded (route-driven) state merged with the user's manual toggles (session-only — resets on refresh). Route wins. */
	const expandedItems = React.useMemo(() => ({ ...storeExpandedItems, ...view.routeState.autoExpandedItems }), [storeExpandedItems, view.routeState.autoExpandedItems]);

	const handleToggle = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(itemId, !(expandedItems[itemId] ?? false));
		},
		[expandedItems, setItemExpanded],
	);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			if (isMobileMenuOpen) {
				setIsMobileMenuOpen(false);
			}
			if (href !== "#") {
				router.push(href);
			}
		},
		[isMobileMenuOpen, setIsMobileMenuOpen, router],
	);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setSearchQuery(event.target.value);
		},
		[setSearchQuery],
	);

	const handleClearSearch = React.useCallback((): void => {
		clearSearch();
	}, [clearSearch]);

	// "/" focuses the search box (GitHub/Linear pattern). Ignored while typing
	// in a text field; Cmd/Ctrl/Alt combos pass through (Cmd+K is the Topbar's).
	React.useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || event.repeat) {
				return;
			}
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}
			if (event.key !== "/") {
				return;
			}
			if (isTypingTarget(event.target)) {
				return;
			}
			event.preventDefault();
			searchInputRef.current?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	// Scroll the active item into view after navigation (audit #8) — but only
	// when the nav area actually scrolls and the item is out of view.
	React.useEffect(() => {
		const container = navContainerRef.current;
		if (container === null) {
			return;
		}
		const activeElement = container.querySelector<HTMLElement>('[data-active="true"]');
		if (activeElement === null) {
			return;
		}
		const isScrollable = container.scrollHeight > container.clientHeight;
		if (!isScrollable) {
			return;
		}
		const containerRect = container.getBoundingClientRect();
		const elementRect = activeElement.getBoundingClientRect();
		const isOutOfView = elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom;
		if (!isOutOfView) {
			return;
		}
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		activeElement.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
	}, [pathname]);

	const handleLogout = React.useCallback((): void => {
		onLogout();
	}, [onLogout]);

	return (
		<div className="flex h-full flex-col bg-sidebar">
			{/* ── Header ──────────────────────────────────────────────────── */}
			<div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border/50">
						<span className="text-sm font-bold text-sidebar-foreground">{getInitials(SIDEBAR_MENU.header.title)}</span>
					</div>
					<div className="min-w-0">
						<span className="block truncate text-sm font-semibold text-sidebar-foreground">{SIDEBAR_MENU.header.title}</span>
						<span className="block truncate text-[11px] text-muted-foreground">{SIDEBAR_MENU.header.subtitle}</span>
					</div>
				</div>
			</div>

			{/* ── Scrollable nav area ────────────────────────────────────── */}
			<div ref={navContainerRef} className="flex-1 overflow-y-auto px-3 py-3">
				{/* Search */}
				<div className="relative mb-4">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
					<input
						ref={searchInputRef}
						type="text"
						placeholder="Search menu…"
						value={searchQuery}
						onChange={handleSearchChange}
						className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/20 pr-7 pl-7 text-xs text-sidebar-foreground transition-all placeholder:text-muted-foreground/50 focus:border-sidebar-ring/60 focus:ring-2 focus:ring-sidebar-ring/40 focus:outline-none"
						aria-label="Search menu"
					/>
					{searchQuery ? (
						<button
							type="button"
							onClick={handleClearSearch}
							className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
							aria-label="Clear search">
							<X className="h-3 w-3" />
						</button>
					) : null}
				</div>

				{/* No results */}
				{view.noResults ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<Search className="mb-2.5 h-7 w-7 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">No menu items found</p>
						<p className="mt-1 text-xs text-muted-foreground/50">Try a different search term</p>
					</div>
				) : null}

				{/* Sections */}
				{view.sections.length > 0 ? (
					<div className="space-y-5">
						{view.sections.map((section, index) => (
							<div key={section.title}>
								<SidebarSectionHeader
									title={section.title}
									index={index}
									isLast={index === view.sections.length - 1}
									isSearching={view.isSearching}
									allTitles={view.sectionTitles}
									isActiveSection={sectionHasActiveItem(section.items, view.routeState.activeItems)}
									onMoveSectionUp={moveSectionUp}
									onMoveSectionDown={moveSectionDown}
								/>
								<div className="space-y-0.5">
									{section.items.map((item) => (
										<SidebarNavItem
											key={item.id}
											item={item}
											isSearching={view.isSearching}
											searchQuery={searchQuery}
											expandedItems={expandedItems}
											activeItems={view.routeState.activeItems}
											onToggle={handleToggle}
											onNavigate={handleNavigate}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				) : null}
			</div>

			{/* ── Footer ──────────────────────────────────────────────────── */}
			<div className="shrink-0 border-t border-sidebar-border bg-sidebar-accent/10">
				<div className="space-y-2 px-3 py-2.5">
					{footerActions.length > 0 ? (
						<div className="flex items-center gap-1 px-1.5">
							{footerActions.map((action) => (
								<button
									key={action.label}
									type="button"
									onClick={action.onClick}
									className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground">
									<action.icon className="h-3.5 w-3.5" />
									<span>{action.label}</span>
								</button>
							))}
						</div>
					) : null}

					{view.bottomItems.length > 0 ? (
						<div className="space-y-0.5">
							{view.bottomItems.map((item) => (
								<SidebarNavItem
									key={item.id}
									item={item}
									isSearching={view.isSearching}
									searchQuery={searchQuery}
									expandedItems={expandedItems}
									activeItems={view.routeState.activeItems}
									onToggle={handleToggle}
									onNavigate={handleNavigate}
								/>
							))}
						</div>
					) : null}

					{/* User */}
					<div className="flex items-center justify-between px-1.5">
						<div className="flex min-w-0 items-center gap-2.5">
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[11px] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
								{getInitials(user.name)}
							</div>
							<div className="min-w-0">
								<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground">{user.name}</span>
								<span className="block truncate text-[11px] leading-tight text-muted-foreground">{user.email}</span>
							</div>
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
							aria-label="Log out"
							title="Log out">
							<LogOut className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
