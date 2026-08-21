"use client";

import { LogOut, Search, X } from "lucide-react";
import * as React from "react";

import { Input } from "@workspace/ui/components/form/input";
import { cn } from "@workspace/ui/lib/utils";

import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { getInitials } from "@/lib/user-initials";
import { sectionHasActiveItem, type SidebarView } from "@/lib/navigation/menu";
import type { AdminSidebarLabels } from "@/lib/sidebar-labels";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

import { SidebarNavItem } from "@/components/layout/sidebar-nav-item";
import { SidebarSectionHeader } from "@/components/layout/sidebar-section-header";

export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly isMobileMenuOpen: boolean;
	readonly setIsMobileMenuOpen: (isOpen: boolean) => void;
	readonly footerActions?: readonly FooterAction[];
	readonly view: SidebarView;
	readonly labels: AdminSidebarLabels;
	readonly searchQuery: string;
	readonly onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onClearSearch: () => void;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleItem: (itemId: string) => void;
	readonly onNavigate: (href: string) => void;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
	/** Changes when route changes — scrolls the active nav item into view. */
	readonly navigationKey?: string;
}

/** True when the keyboard event target is a text-entry element (don't hijack "/"). */
function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

/**
 * Admin sidebar shell — props only. Route/search/expand state comes from
 * `DashboardLayout`; this component does not touch Zustand.
 */
export function Sidebar({
	user,
	onLogout,
	isMobileMenuOpen,
	setIsMobileMenuOpen,
	footerActions = [],
	view,
	labels,
	searchQuery,
	onSearchChange,
	onClearSearch,
	expandedItems,
	onToggleItem,
	onNavigate,
	onMoveSectionUp,
	onMoveSectionDown,
	navigationKey,
}: SidebarProps): React.JSX.Element {
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const navContainerRef = React.useRef<HTMLDivElement>(null);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			if (isMobileMenuOpen) {
				setIsMobileMenuOpen(false);
			}
			if (href !== "#") {
				onNavigate(href);
			}
		},
		[isMobileMenuOpen, setIsMobileMenuOpen, onNavigate],
	);

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

	React.useEffect(() => {
		if (navigationKey === undefined) {
			return;
		}
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
	}, [navigationKey]);

	const handleLogout = React.useCallback((): void => {
		onLogout();
	}, [onLogout]);

	return (
		<div className="flex h-full flex-col bg-sidebar">
			<div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border/50">
						<span className="text-sm font-bold text-sidebar-foreground">{getInitials(SIDEBAR_MENU.header.title)}</span>
					</div>
					<div className="min-w-0">
						<span className="block truncate text-sm font-semibold text-sidebar-foreground">{SIDEBAR_MENU.header.title}</span>
						<span className="block truncate text-[length:var(--text-sidebar-caption)] text-muted-foreground">{SIDEBAR_MENU.header.subtitle}</span>
					</div>
				</div>
			</div>

			<div ref={navContainerRef} className="flex-1 overflow-y-auto px-3 py-3">
				<div className="relative mb-4">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
					<Input
						ref={searchInputRef}
						type="search"
						placeholder={labels.searchPlaceholder}
						value={searchQuery}
						onChange={onSearchChange}
						aria-label={labels.searchAriaLabel}
						className="h-8 border-sidebar-border bg-sidebar-accent/20 pr-7 pl-7 text-xs shadow-none placeholder:text-muted-foreground/50 focus-visible:border-sidebar-ring/60 focus-visible:ring-sidebar-ring/40"
					/>
					{searchQuery ? (
						<button
							type="button"
							onClick={onClearSearch}
							className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
							aria-label={labels.clearSearchAriaLabel}>
							<X className="h-3 w-3" />
						</button>
					) : null}
				</div>

				{view.noResults ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<Search className="mb-2.5 h-7 w-7 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">{labels.noResultsTitle}</p>
						<p className="mt-1 text-xs text-muted-foreground/50">{labels.noResultsDescription}</p>
					</div>
				) : null}

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
									labels={labels}
									onMoveSectionUp={onMoveSectionUp}
									onMoveSectionDown={onMoveSectionDown}
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
											labels={labels}
											onToggle={onToggleItem}
											onNavigate={handleNavigate}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				) : null}
			</div>

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
									labels={labels}
									onToggle={onToggleItem}
									onNavigate={handleNavigate}
								/>
							))}
						</div>
					) : null}

					<div className="flex items-center justify-between px-1.5">
						<div className="flex min-w-0 items-center gap-2.5">
							<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
								{getInitials(user.name)}
							</div>
							<div className="min-w-0">
								<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground">{user.name}</span>
								<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground">{user.email}</span>
							</div>
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
							aria-label={labels.logoutAriaLabel}
							title={labels.logoutTitle}>
							<LogOut className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
