"use client";

import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
	useSidebar,
} from "@workspace/ui/components/navigation/sidebar";
import { LogOut, Search } from "lucide-react";
import * as React from "react";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { getInitials } from "@/lib/user-initials";
import { sectionHasActiveItem, isRouteActive, type SidebarView, type SearchableMenuItem } from "@/lib/navigation/menu";
import type { AdminSidebarLabels } from "@/lib/sidebar-labels";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

import { SidebarMenuSearch } from "@/components/layout/sidebar/sidebar-menu-search";
import { SidebarNavItem } from "@/components/layout/sidebar/sidebar-nav-item";
import { SidebarSectionHeader } from "@/components/layout/sidebar/sidebar-section-header";
import { SidebarWorkspaceSwitcher, type SidebarWorkspace } from "@/components/layout/sidebar/sidebar-workspace-switcher";

export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
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
	readonly pinnedItems: readonly SearchableMenuItem[];
	readonly workspaces: readonly SidebarWorkspace[];
	readonly activeWorkspaceId: string;
	readonly onWorkspaceChange: (workspaceId: string) => void;
	/** Changes when route changes — scrolls the active nav item into view. */
	readonly navigationKey?: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

interface PinnedSidebarMenuItemProps {
	readonly pinned: SearchableMenuItem;
	readonly isActive: boolean;
	readonly onNavigate: (href: string) => void;
}

function renderPinnedMenuIcon(iconName: string | undefined): React.ReactNode {
	const Icon = iconName !== undefined ? (ICON_MAP[iconName] ?? Search) : Search;
	return <Icon />;
}

function PinnedSidebarMenuItem({ pinned, isActive, onNavigate }: PinnedSidebarMenuItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onNavigate(pinned.url);
	}, [onNavigate, pinned.url]);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={isActive} onClick={handleClick} tooltip={{ children: pinned.title }}>
				{renderPinnedMenuIcon(pinned.icon)}
				<span className="truncate">{pinned.title}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

/** Admin sidebar panel — props only; state lives in `DashboardLayout`. */
export function AdminSidebarPanel({
	user,
	onLogout,
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
	pinnedItems,
	workspaces,
	activeWorkspaceId,
	onWorkspaceChange,
	navigationKey,
}: SidebarProps): React.JSX.Element {
	const { setOpenMobile, isMobile } = useSidebar();
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const navContainerRef = React.useRef<HTMLDivElement>(null);
	// Derive route announcement for screen readers — computed inline, no state needed.
	const routeAnnouncement = React.useMemo((): string => {
		if (navigationKey === undefined) {
			return "";
		}
		const segments = navigationKey.split("/").filter(Boolean);
		const lastSegment = segments[segments.length - 1] ?? "Home";
		const pageName = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, " ");
		return `Navigated to ${pageName}`;
	}, [navigationKey]);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			if (isMobile) {
				setOpenMobile(false);
			}
			if (href !== "#") {
				onNavigate(href);
			}
		},
		[isMobile, setOpenMobile, onNavigate],
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

		// Defer until branch collapse finishes — avoids scroll anchoring fighting the height tween.
		const timeoutId = window.setTimeout((): void => {
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
		}, 220);

		return (): void => {
			window.clearTimeout(timeoutId);
		};
	}, [navigationKey]);

	const handleLogout = React.useCallback((): void => {
		onLogout();
	}, [onLogout]);

	const showPinned = pinnedItems.length > 0;

	return (
		<>
			<SidebarHeader className="border-b border-sidebar-border">
				<div className="flex min-w-0 items-center gap-3 px-2 py-2">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border/50">
						<span className="text-sm font-bold text-sidebar-foreground">{getInitials(SIDEBAR_MENU.header.title)}</span>
					</div>
					<div className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold text-sidebar-foreground">{SIDEBAR_MENU.header.title}</span>
						<SidebarWorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} onWorkspaceChange={onWorkspaceChange} labels={labels} />
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent ref={navContainerRef} className="[overflow-anchor:none]">
				<SidebarMenuSearch
					inputRef={searchInputRef}
					value={searchQuery}
					placeholder={labels.searchPlaceholder}
					ariaLabel={labels.searchAriaLabel}
					clearAriaLabel={labels.clearSearchAriaLabel}
					onChange={onSearchChange}
					onClear={onClearSearch}
				/>

				{view.noResults ? (
					<div className="flex flex-col items-center justify-center px-2 py-10 text-center">
						<Search className="mb-2.5 h-7 w-7 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">{labels.noResultsTitle}</p>
						<p className="mt-1 text-xs text-muted-foreground/50">{labels.noResultsDescription}</p>
					</div>
				) : null}

				{showPinned ? (
					<>
						<SidebarGroup>
							<SidebarGroupLabel>{labels.pinnedSectionTitle}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu className="gap-0.5">
									{pinnedItems.map((pinned) => (
										<PinnedSidebarMenuItem
											key={pinned.url}
											pinned={pinned}
											isActive={navigationKey !== undefined ? isRouteActive(pinned.url, navigationKey) : false}
											onNavigate={handleNavigate}
										/>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
						<SidebarSeparator />
					</>
				) : null}

				{view.sections.map((section, index) => (
					<SidebarGroup key={section.title}>
						<SidebarSectionHeader
							title={section.title}
							index={index}
							isLast={index === view.sections.length - 1}
							isSearching={view.isSearching}
							allTitles={view.sectionTitles}
							isActiveSection={sectionHasActiveItem(section.items, view.routeState.activeItems)}
							labels={labels}
							color={section.color}
							onMoveSectionUp={onMoveSectionUp}
							onMoveSectionDown={onMoveSectionDown}
						/>
						<SidebarGroupContent>
							<SidebarMenu className="gap-0.5">
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="border-t border-sidebar-border bg-sidebar-accent/10">
				{footerActions.length > 0 ? (
					<div className="flex items-center gap-1 px-2">
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
					<SidebarMenu className="gap-0.5">
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
					</SidebarMenu>
				) : null}

				<div className="flex items-center justify-between px-2 py-2">
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
			</SidebarFooter>{" "}
			<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
				{routeAnnouncement}
			</div>
		</>
	);
}

/** @deprecated Use `AdminSidebarPanel` — kept for tests and gradual migration. */
export const Sidebar = AdminSidebarPanel;
