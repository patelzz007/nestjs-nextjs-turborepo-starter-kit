"use client";

import { LogOut, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { SIDEBAR_MENU } from "@/config/sidebar-menu";
import { getInitials } from "@/lib/user-initials";
import { computeRouteState, createItemId, filterItemsBySearch } from "@/lib/menu";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { FooterAction, SidebarMenuItem, SidebarUser } from "@/types/sidebar";

import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { SidebarSectionHeader } from "@/components/layout/sidebar-section-header";

export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly isMobileMenuOpen: boolean;
	readonly setIsMobileMenuOpen: (isOpen: boolean) => void;
	/** When true, a top-level item stays highlighted while any of its children is active. */
	readonly isHighlightParentItem?: boolean;
	readonly footerActions?: readonly FooterAction[];
}

/**
 * The admin sidebar. The nav tree is loaded from `config/sidebar-menu.json`
 * (see `config/sidebar-menu.ts`) — no hardcoded items live here. The active
 * route is derived from the current pathname, sections can be reordered
 * (persisted in the Zustand store), and the menu is searchable with match
 * highlighting.
 */
export function Sidebar({ user, onLogout, isMobileMenuOpen, setIsMobileMenuOpen, isHighlightParentItem = false, footerActions = [] }: SidebarProps): React.JSX.Element {
	const router = useRouter();
	const pathname = usePathname();
	const sectionOrder = useSidebarStore((s) => s.sectionOrder);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);

	const [manualExpanded, setManualExpanded] = React.useState<Record<string, boolean>>({});
	const [searchQuery, setSearchQuery] = React.useState("");

	const isSearching = searchQuery.trim().length > 0;

	const allItems = React.useMemo((): readonly SidebarMenuItem[] => {
		const sectionItems = SIDEBAR_MENU.sections.flatMap((section) => section.items);
		return [...sectionItems, ...SIDEBAR_MENU.bottomItems];
	}, []);

	const routeState = React.useMemo(() => computeRouteState(allItems, pathname, isHighlightParentItem), [allItems, pathname, isHighlightParentItem]);

	/** Auto-expanded (route-driven) state merged with the user's manual toggles. */
	const expandedItems = React.useMemo(() => ({ ...routeState.autoExpandedItems, ...manualExpanded }), [routeState.autoExpandedItems, manualExpanded]);

	const handleToggle = React.useCallback(
		(itemId: string): void => {
			setManualExpanded((previous) => ({
				...previous,
				[itemId]: !(previous[itemId] ?? routeState.autoExpandedItems[itemId] ?? false),
			}));
		},
		[routeState.autoExpandedItems],
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

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const value = event.target.value;
		setSearchQuery(value);
		// Restore the route-driven expansion when the search is cleared.
		if (value.trim().length === 0) {
			setManualExpanded({});
		}
	}, []);

	const handleClearSearch = React.useCallback((): void => {
		setSearchQuery("");
		setManualExpanded({});
	}, []);

	const filteredSections = React.useMemo(
		() => SIDEBAR_MENU.sections.map((section) => ({ ...section, items: filterItemsBySearch(section.items, searchQuery) })).filter((section) => section.items.length > 0),
		[searchQuery],
	);

	const filteredBottomItems = React.useMemo(() => filterItemsBySearch(SIDEBAR_MENU.bottomItems, searchQuery), [searchQuery]);

	const allSectionTitles = React.useMemo(() => filteredSections.map((section) => section.title), [filteredSections]);

	const orderedSections = React.useMemo(() => {
		if (sectionOrder === null) {
			return filteredSections;
		}
		return [...filteredSections].sort((a, b): number => {
			const aIndex = sectionOrder.indexOf(a.title);
			const bIndex = sectionOrder.indexOf(b.title);
			if (aIndex === -1 && bIndex === -1) {
				return 0;
			}
			if (aIndex === -1) {
				return 1;
			}
			if (bIndex === -1) {
				return -1;
			}
			return aIndex - bIndex;
		});
	}, [filteredSections, sectionOrder]);

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
			<div className="flex-1 overflow-y-auto px-3 py-3">
				{/* Search */}
				<div className="relative mb-4">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
					<input
						type="text"
						placeholder="Search menu..."
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
				{isSearching && orderedSections.length === 0 && filteredBottomItems.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<Search className="mb-2.5 h-7 w-7 text-muted-foreground/30" />
						<p className="text-sm text-muted-foreground">No menu items found</p>
						<p className="mt-1 text-xs text-muted-foreground/50">Try a different search term</p>
					</div>
				) : null}

				{/* Sections */}
				{orderedSections.length > 0 ? (
					<div className="space-y-5">
						{orderedSections.map((section, index) => (
							<div key={section.title}>
								<SidebarSectionHeader
									title={section.title}
									index={index}
									isLast={index === orderedSections.length - 1}
									isSearching={isSearching}
									allTitles={allSectionTitles}
									onMoveSectionUp={moveSectionUp}
									onMoveSectionDown={moveSectionDown}
								/>
								<div className="space-y-0.5">
									{section.items.map((item) => (
										<SidebarNavItem
											key={createItemId(item, "")}
											item={item}
											parentId=""
											isSearching={isSearching}
											searchQuery={searchQuery}
											expandedItems={expandedItems}
											activeItems={routeState.activeItems}
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

					{filteredBottomItems.length > 0 ? (
						<div className="space-y-0.5">
							{filteredBottomItems.map((item) => (
								<SidebarNavItem
									key={createItemId(item, "")}
									item={item}
									parentId=""
									isSearching={isSearching}
									searchQuery={searchQuery}
									expandedItems={expandedItems}
									activeItems={routeState.activeItems}
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
