"use client";

import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { WebSidebarNavItem } from "@/components/layout/web-sidebar-nav-item";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveWebPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { useSessionCapabilities } from "@/lib/session-capabilities";
import { WEB_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import { renderWebPaletteIcon } from "@/lib/palette/nav-items";
import { useWebCommandPaletteStore } from "@/stores/command-palette-store";
import { useWebSidebarStore } from "@/stores/sidebar-store";
import { useAuth } from "@workspace/client/lib/auth";
import type { CompiledSidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";
import { PanelSidebarHeader } from "@workspace/ui/components/navigation/panel-sidebar-header";
import { PanelSidebarSearch } from "@workspace/ui/components/navigation/panel-sidebar-search";
import { PanelSidebarSectionHeader } from "@workspace/ui/components/navigation/panel-sidebar-section-header";
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@workspace/ui/components/navigation/sidebar";
import { useDebouncedCallback } from "@workspace/ui/hooks/use-debounced-callback";
import { useRouteExpandedItems } from "@workspace/ui/hooks/use-route-expanded-items";
import { buildSidebarView, isRouteActive, sectionHasActiveItem } from "@workspace/ui/lib/sidebar-menu-view";
import { getUserInitials } from "@workspace/ui/lib/user-initials";
import { Gift, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

export interface WebSidebarPanelProps {
	readonly userName: string | null;
	readonly sessionActive?: boolean;
	readonly initialSessionPermissions?: SessionPermissionsResponse;
	readonly onNavigate?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

interface WebSidebarPinnedItemProps {
	readonly title: string;
	readonly url: string;
	readonly icon: string | undefined;
	readonly isActive: boolean;
	readonly onNavigate: (href: string) => void;
}

function WebSidebarPinnedItem({ title, url, icon, isActive, onNavigate }: WebSidebarPinnedItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onNavigate(url);
	}, [onNavigate, url]);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={isActive} onClick={handleClick} tooltip={{ children: title }}>
				{renderWebPaletteIcon(icon, "size-4")}
				<span className="truncate">{title}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function WebSidebarPanel({
	userName,
	sessionActive = false,
	initialSessionPermissions,
	onNavigate,
}: WebSidebarPanelProps): React.JSX.Element {
	const pathname = usePathname();
	const router = useRouter();
	const { user } = useAuth();
	const { capabilities, isReady: isCapabilitiesReady } = useSessionCapabilities(initialSessionPermissions, sessionActive);
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const navContainerRef = React.useRef<HTMLDivElement>(null);

	const sectionOrder = useWebSidebarStore((state) => state.sectionOrder);
	const searchQuery = useWebSidebarStore((state) => state.searchQuery);
	const menu = useWebSidebarStore((state) => state.menu);
	const displayMenu = React.useMemo((): CompiledSidebarMenuData => {
		return {
			header: menu.header,
			sections: menu.sections,
			bottomItems: menu.bottomItems.length > 0 ? menu.bottomItems : USER_SIDEBAR_MENU.bottomItems,
		};
	}, [menu]);

	const filterCapabilities = React.useMemo((): readonly CapabilitySlug[] => {
		if (isCapabilitiesReady && capabilities.length > 0) {
			return capabilities;
		}
		return initialSessionPermissions?.capabilities ?? [];
	}, [capabilities, initialSessionPermissions?.capabilities, isCapabilitiesReady]);

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(displayMenu, filterCapabilities), [displayMenu, filterCapabilities]);
	const currentPage = pathname;
	const setSearchQuery = useWebSidebarStore((state) => state.setSearchQuery);
	const clearSearch = useWebSidebarStore((state) => state.clearSearch);
	const storeExpandedItems = useWebSidebarStore((state) => state.expandedItems);
	const setItemExpanded = useWebSidebarStore((state) => state.setItemExpanded);
	const resetExpandedItems = useWebSidebarStore((state) => state.resetExpandedItems);
	const moveSectionUp = useWebSidebarStore((state) => state.moveSectionUp);
	const moveSectionDown = useWebSidebarStore((state) => state.moveSectionDown);
	const pinnedUrls = useWebCommandPaletteStore((state) => state.pinnedUrls);

	const view = React.useMemo(
		() => buildSidebarView({ menu: filteredMenu, pathname: currentPage, sectionOrder, searchQuery, isHighlightParentItem: true }),
		[filteredMenu, currentPage, sectionOrder, searchQuery],
	);

	const pinnedItems = React.useMemo(() => resolveWebPinnedMenuItems(pinnedUrls), [pinnedUrls]);
	const expandedItems = useRouteExpandedItems(currentPage, storeExpandedItems, view.routeState.autoExpandedItems, resetExpandedItems);
	const activeItems = view.routeState.activeItems;

	const routeAnnouncement = React.useMemo((): string => {
		const segments = currentPage.split("/").filter(Boolean);
		const lastSegment = segments[segments.length - 1] ?? "Home";
		const pageName = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, " ");
		return `Navigated to ${pageName}`;
	}, [currentPage]);

	const debouncedSetSearchQuery = useDebouncedCallback(setSearchQuery, 150);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			debouncedSetSearchQuery(event.target.value);
		},
		[debouncedSetSearchQuery],
	);

	const handleClearSearch = React.useCallback((): void => {
		clearSearch();
	}, [clearSearch]);

	const handleToggleExpand = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(itemId, !(expandedItems[itemId] ?? false));
		},
		[expandedItems, setItemExpanded],
	);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			onNavigate?.();
			router.push(href);
		},
		[onNavigate, router],
	);

	React.useEffect((): (() => void) => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.key !== "/") {
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

	React.useEffect((): (() => void) | undefined => {
		const container = navContainerRef.current;
		if (container === null) {
			return;
		}

		const timeoutId = window.setTimeout((): void => {
			const activeElement = container.querySelector<HTMLElement>('[data-active="true"], .bg-sidebar-primary');
			if (activeElement === null || container.scrollHeight <= container.clientHeight) {
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
	}, [currentPage]);

	const displayName = user?.fullName ?? userName;
	const userInitials = displayName !== null ? getUserInitials(displayName) : "?";
	const showPinned = pinnedItems.length > 0 && !view.noResults;

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-sidebar-foreground">
			<PanelSidebarHeader title={filteredMenu.header.title} subtitle={filteredMenu.header.subtitle} icon={<Gift className="size-4 text-primary" aria-hidden="true" />} />

			<SidebarContent ref={navContainerRef} className="[overflow-anchor:none]">
				<PanelSidebarSearch
					inputRef={searchInputRef}
					value={searchQuery}
					placeholder={WEB_SIDEBAR_LABELS.searchPlaceholder}
					ariaLabel={WEB_SIDEBAR_LABELS.searchAriaLabel}
					clearAriaLabel={WEB_SIDEBAR_LABELS.clearSearchAriaLabel}
					onChange={handleSearchChange}
					onClear={handleClearSearch}
				/>

				{view.noResults ? (
					<div className="flex flex-col items-center justify-center px-2 py-10 text-center">
						<Search className="mb-2.5 size-7 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">{WEB_SIDEBAR_LABELS.noResultsTitle}</p>
						<p className="mt-1 text-xs text-muted-foreground/50">{WEB_SIDEBAR_LABELS.noResultsDescription}</p>
					</div>
				) : null}

				{showPinned ? (
					<>
						<SidebarGroup>
							<SidebarGroupLabel>{WEB_SIDEBAR_LABELS.pinnedSectionTitle}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu className="gap-0.5">
									{pinnedItems.map((pinned) => (
										<WebSidebarPinnedItem
											key={pinned.url}
											title={pinned.title}
											url={pinned.url}
											icon={pinned.icon}
											isActive={isRouteActive(pinned.url, currentPage)}
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
						<PanelSidebarSectionHeader
							title={section.title}
							index={index}
							isLast={index === view.sections.length - 1}
							isSearching={view.isSearching}
							isActiveSection={sectionHasActiveItem(section.items, activeItems)}
							allTitles={view.sectionTitles}
							color={section.color}
							moveUpTitle={WEB_SIDEBAR_LABELS.moveSectionUpTitle}
							moveDownTitle={WEB_SIDEBAR_LABELS.moveSectionDownTitle}
							moveUpAriaLabel={WEB_SIDEBAR_LABELS.moveSectionUpAriaLabel(section.title)}
							moveDownAriaLabel={WEB_SIDEBAR_LABELS.moveSectionDownAriaLabel(section.title)}
							onMoveSectionUp={moveSectionUp}
							onMoveSectionDown={moveSectionDown}
						/>
						<SidebarGroupContent>
							<SidebarMenu className="gap-0.5">
								{section.items.map((item) => (
									<WebSidebarNavItem
										key={item.id}
										item={item}
										activeItems={activeItems}
										expandedItems={expandedItems}
										onToggleExpand={handleToggleExpand}
										onNavigate={handleNavigate}
										searchQuery={searchQuery}
										isSearching={view.isSearching}
									/>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter className="max-h-[min(45vh,22rem)] shrink-0 overflow-y-auto border-t border-sidebar-border bg-sidebar-accent/10">
				{displayName !== null ? (
					<div className="flex items-center gap-2.5 px-2 py-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
							{userInitials}
						</div>
						<div className="min-w-0 flex-1">
							<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground">{displayName}</span>
							{user !== null ? <span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground">{user.email}</span> : null}
						</div>
					</div>
				) : (
					<p className="px-2 py-2 text-xs text-muted-foreground">Browse as guest</p>
				)}

				{view.bottomItems.length > 0 ? (
					<SidebarMenu className="gap-0.5">
						{view.bottomItems.map((item) => (
							<WebSidebarNavItem
								key={item.id}
								item={item}
								activeItems={activeItems}
								expandedItems={expandedItems}
								onToggleExpand={handleToggleExpand}
								onNavigate={handleNavigate}
								searchQuery={searchQuery}
								isSearching={view.isSearching}
							/>
						))}
					</SidebarMenu>
				) : null}

				<div className={view.bottomItems.length > 0 ? "px-2 pt-2" : "px-2 pb-2"}>
					<ImpersonateUserPanel sessionActive={sessionActive} />
				</div>
			</SidebarFooter>

			<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
				{routeAnnouncement}
			</div>
		</div>
	);
}
