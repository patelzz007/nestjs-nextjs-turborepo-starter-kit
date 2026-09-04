"use client";

import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { MerchantSidebarNavItem } from "@/components/layout/merchant-sidebar-nav-item";
import { useMerchantSessionProfile } from "@/lib/merchant-session-profile";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { resolveMerchantPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { MERCHANT_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import { renderMerchantPaletteIcon } from "@/lib/palette/nav-items";
import { useMerchantCommandPaletteStore } from "@/stores/command-palette-store";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";
import { useMerchantOrg } from "@/lib/merchant-root-provider";
import type { MerchantMembershipResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
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

export interface MerchantSidebarPanelProps {
	readonly memberships: readonly MerchantMembershipResponse[];
	readonly merchantOrgId: string | undefined;
	readonly onStoreChange: (orgId: string) => void;
	readonly onNavigate?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
}

interface MerchantSidebarPinnedItemProps {
	readonly title: string;
	readonly url: string;
	readonly icon: string | undefined;
	readonly isActive: boolean;
	readonly onNavigate: (href: string) => void;
}

function MerchantSidebarPinnedItem({ title, url, icon, isActive, onNavigate }: MerchantSidebarPinnedItemProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onNavigate(url);
	}, [onNavigate, url]);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton isActive={isActive} onClick={handleClick} tooltip={{ children: title }}>
				{renderMerchantPaletteIcon(icon, "size-4")}
				<span className="truncate">{title}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function MerchantSidebarPanel({ memberships, merchantOrgId, onStoreChange, onNavigate }: MerchantSidebarPanelProps): React.JSX.Element {
	const pathname = usePathname();
	const router = useRouter();
	const sessionProfile = useMerchantSessionProfile();
	const activeMembership = memberships.find((row) => row.merchantOrgId === merchantOrgId);
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const navContainerRef = React.useRef<HTMLDivElement>(null);

	const sectionOrder = useMerchantSidebarStore((state) => state.sectionOrder);
	const searchQuery = useMerchantSidebarStore((state) => state.searchQuery);
	const menu = useMerchantSidebarStore((state) => state.menu);
	const currentPage = useMerchantSidebarStore((state) => state.currentPage) ?? pathname;
	const setSearchQuery = useMerchantSidebarStore((state) => state.setSearchQuery);
	const clearSearch = useMerchantSidebarStore((state) => state.clearSearch);
	const storeExpandedItems = useMerchantSidebarStore((state) => state.expandedItems);
	const setItemExpanded = useMerchantSidebarStore((state) => state.setItemExpanded);
	const resetExpandedItems = useMerchantSidebarStore((state) => state.resetExpandedItems);
	const moveSectionUp = useMerchantSidebarStore((state) => state.moveSectionUp);
	const moveSectionDown = useMerchantSidebarStore((state) => state.moveSectionDown);
	const pinnedUrls = useMerchantCommandPaletteStore((state) => state.pinnedUrls);

	const capabilities = React.useMemo(() => activeMembership?.capabilities ?? [], [activeMembership]);

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(menu, capabilities), [menu, capabilities]);

	const view = React.useMemo(
		() => buildSidebarView({ menu: filteredMenu, pathname: currentPage, sectionOrder, searchQuery, isHighlightParentItem: true }),
		[filteredMenu, currentPage, sectionOrder, searchQuery],
	);

	const pinnedItems = React.useMemo(() => resolveMerchantPinnedMenuItems(pinnedUrls, capabilities), [pinnedUrls, capabilities]);
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

	const handleStoreChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onStoreChange(value);
			}
		},
		[onStoreChange],
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

	React.useEffect((): (() => void) | void => {
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

	const userInitials = getUserInitials(sessionProfile.fullName);
	const showPinned = pinnedItems.length > 0 && !view.noResults;
	const formatStoreValue = React.useCallback(
		(orgId: string): string => memberships.find((row) => row.merchantOrgId === orgId)?.businessName ?? orgId,
		[memberships],
	);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-sidebar-foreground">
			<PanelSidebarHeader title={menu.header.title} subtitle={menu.header.subtitle} icon={<Gift className="size-4 text-primary" aria-hidden="true" />} />

			<SidebarContent ref={navContainerRef} className="[overflow-anchor:none]">
				<PanelSidebarSearch
					inputRef={searchInputRef}
					value={searchQuery}
					placeholder={MERCHANT_SIDEBAR_LABELS.searchPlaceholder}
					ariaLabel={MERCHANT_SIDEBAR_LABELS.searchAriaLabel}
					clearAriaLabel={MERCHANT_SIDEBAR_LABELS.clearSearchAriaLabel}
					onChange={handleSearchChange}
					onClear={handleClearSearch}
				/>

				{view.noResults ? (
					<div className="flex flex-col items-center justify-center px-2 py-10 text-center">
						<Search className="mb-2.5 size-7 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm text-muted-foreground">{MERCHANT_SIDEBAR_LABELS.noResultsTitle}</p>
						<p className="mt-1 text-xs text-muted-foreground/50">{MERCHANT_SIDEBAR_LABELS.noResultsDescription}</p>
					</div>
				) : null}

				{showPinned ? (
					<>
						<SidebarGroup>
							<SidebarGroupLabel>{MERCHANT_SIDEBAR_LABELS.pinnedSectionTitle}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu className="gap-0.5">
									{pinnedItems.map((pinned) => (
										<MerchantSidebarPinnedItem
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
							moveUpTitle={MERCHANT_SIDEBAR_LABELS.moveSectionUpTitle}
							moveDownTitle={MERCHANT_SIDEBAR_LABELS.moveSectionDownTitle}
							moveUpAriaLabel={MERCHANT_SIDEBAR_LABELS.moveSectionUpAriaLabel(section.title)}
							moveDownAriaLabel={MERCHANT_SIDEBAR_LABELS.moveSectionDownAriaLabel(section.title)}
							onMoveSectionUp={moveSectionUp}
							onMoveSectionDown={moveSectionDown}
						/>
						<SidebarGroupContent>
							<SidebarMenu className="gap-0.5">
								{section.items.map((item) => (
									<MerchantSidebarNavItem
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
				<div className="flex items-center gap-2.5 px-2 py-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
						{userInitials}
					</div>
					<div className="min-w-0 flex-1">
						<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground">{sessionProfile.fullName}</span>
						<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground">{sessionProfile.email}</span>
					</div>
				</div>

				{activeMembership !== undefined ? (
					<div className="px-2 pb-2">
						<div className="min-w-0 overflow-hidden rounded-lg border border-sidebar-border bg-background/60 px-3 py-3">
							<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active store</p>
							<p className="mt-1 truncate text-sm font-semibold text-sidebar-foreground">{activeMembership.businessName}</p>
							<Badge variant="secondary" className="mt-2">
								{activeMembership.role}
							</Badge>
							{memberships.length > 1 ? (
								<div className="mt-3 space-y-1">
									<Label className="text-xs">Switch store</Label>
									<Select value={merchantOrgId ?? ""} onValueChange={handleStoreChange}>
										<SelectTrigger className="w-full min-w-0">
											<SelectValue placeholder="Select store" formatValue={formatStoreValue} />
										</SelectTrigger>
										<SelectContent>
											{memberships.map((row) => (
												<SelectItem key={row.merchantOrgId} value={row.merchantOrgId}>
													{row.businessName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : null}
						</div>
					</div>
				) : null}

				{view.bottomItems.length > 0 ? (
					<SidebarMenu className="gap-0.5">
						{view.bottomItems.map((item) => (
							<MerchantSidebarNavItem
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
					<ImpersonateUserPanel />
				</div>
			</SidebarFooter>

			<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
				{routeAnnouncement}
			</div>
		</div>
	);
}
