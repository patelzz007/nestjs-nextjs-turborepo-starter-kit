"use client";

import { PanelSidebarNavItem, type PanelSidebarRenderIcon, type PanelSidebarRenderLink } from "@workspace/ui/components/panel-sidebar-nav-item";
import { PanelSidebarSearch } from "@workspace/ui/components/panel-sidebar-search";
import { PanelSidebarSectionHeader } from "@workspace/ui/components/panel-sidebar-section-header";
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
	useSidebar,
} from "@workspace/ui/components/sidebar";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useFocusShortcut } from "@workspace/ui/hooks/use-focus-shortcut";
import { useScrollActiveNavItem } from "@workspace/ui/hooks/use-scroll-active-nav-item";
import { mergeRefs } from "@workspace/ui/lib/core/merge-refs";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { isRouteActive, sectionHasActiveItem, type SidebarMenuItemLike, type SidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { Search } from "lucide-react";
import * as React from "react";

/** The key that jumps to the sidebar search box. */
const SEARCH_SHORTCUT_KEY = "/";

/** A page the member pinned from the command palette. */
export interface PanelSidebarPinnedItem {
	readonly title: string;
	/** Already resolved for this app (e.g. organization-scoped). */
	readonly url: string;
	readonly icon?: string | undefined;
	/** Shown but not followable (e.g. while enrollment locks navigation). */
	readonly disabled?: boolean | undefined;
}

/** What every row of the nav tree needs from the app. */
interface NavRowContext {
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleExpand: (itemId: string) => void;
	readonly onNavigate?: (() => void) | undefined;
	readonly renderLink: PanelSidebarRenderLink;
	readonly renderIcon: PanelSidebarRenderIcon;
	readonly searchQuery: string;
	readonly isSearching: boolean;
	readonly unavailableTitle: string;
}

function NavItemList({ items, context }: { readonly items: readonly SidebarMenuItemLike[]; readonly context: NavRowContext }): React.JSX.Element {
	return (
		<>
			{items.map((item) => (
				<PanelSidebarNavItem
					key={item.id}
					item={item}
					activeItems={context.activeItems}
					expandedItems={context.expandedItems}
					onToggleExpand={context.onToggleExpand}
					onNavigate={context.onNavigate}
					renderLink={context.renderLink}
					renderIcon={context.renderIcon}
					searchQuery={context.searchQuery}
					isSearching={context.isSearching}
					unavailableTitle={context.unavailableTitle}
				/>
			))}
		</>
	);
}

interface PinnedRowProps {
	readonly pinned: PanelSidebarPinnedItem;
	readonly isActive: boolean;
	readonly renderIcon: PanelSidebarRenderIcon;
	readonly context: NavRowContext;
}

/** A disabled pinned row is an unavailable link: focusable (so its tooltip can be read) but never followed. */
const DISABLED_PINNED_ROW_RENDER = <span role="link" aria-disabled="true" tabIndex={0} />;

function PinnedRow({ pinned, isActive, renderIcon, context }: PinnedRowProps): React.JSX.Element {
	const isDisabled = pinned.disabled === true;
	const tooltip = React.useMemo(() => ({ children: isDisabled ? context.unavailableTitle : pinned.title }), [isDisabled, context.unavailableTitle, pinned.title]);
	const content = (
		<>
			{renderIcon(pinned.icon, "size-4")}
			<span className="truncate">{pinned.title}</span>
		</>
	);
	return (
		<SidebarMenuItem>
			{isDisabled ? (
				<SidebarMenuButton render={DISABLED_PINNED_ROW_RENDER} disabled title={context.unavailableTitle} tooltip={tooltip}>
					{content}
				</SidebarMenuButton>
			) : (
				<SidebarMenuButton
					render={context.renderLink(pinned.url)}
					isActive={isActive}
					aria-current={isActive ? "page" : undefined}
					title={pinned.title}
					onClick={context.onNavigate}
					tooltip={tooltip}>
					{content}
				</SidebarMenuButton>
			)}
		</SidebarMenuItem>
	);
}

/** Builds the per-row context once per change of its inputs — every row reads it, so it must keep its identity. */
function useNavRowContext(
	view: SidebarView,
	expandedItems: Readonly<Record<string, boolean>>,
	onToggleExpand: (itemId: string) => void,
	onNavigate: () => void,
	renderLink: PanelSidebarRenderLink,
	renderIcon: PanelSidebarRenderIcon,
	searchQuery: string,
	unavailableTitle: string,
): NavRowContext {
	const activeItems = view.routeState.activeItems;
	const isSearching = view.isSearching;
	return React.useMemo(
		(): NavRowContext => ({ activeItems, expandedItems, onToggleExpand, onNavigate, renderLink, renderIcon, searchQuery, isSearching, unavailableTitle }),
		[activeItems, expandedItems, onToggleExpand, onNavigate, renderLink, renderIcon, searchQuery, isSearching, unavailableTitle],
	);
}

/** Following a link closes the mobile drawer (the desktop rail stays as it is). */
function useCloseMobileSidebar(): () => void {
	const { isMobile, setOpenMobile } = useSidebar();
	return React.useCallback((): void => {
		if (isMobile) {
			setOpenMobile(false);
		}
	}, [isMobile, setOpenMobile]);
}

export interface PanelSidebarNavProps {
	readonly view: SidebarView;
	/** The current pathname (for pinned rows and keeping the current page in view). */
	readonly pathname: string;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleExpand: (itemId: string) => void;
	readonly renderLink: PanelSidebarRenderLink;
	/** Renders a menu item's icon by name (the app's menu icon map). */
	readonly renderIcon: PanelSidebarRenderIcon;
	/** Renders a pinned page's icon, when pins name icons differently from the menu (e.g. palette ids). Defaults to `renderIcon`. */
	readonly renderPinnedIcon?: PanelSidebarRenderIcon | undefined;
	/** The committed search text and its setter (the sidebar store's). */
	readonly searchQuery: string;
	readonly onSearchQueryChange: (query: string) => void;
	readonly pinnedItems: readonly PanelSidebarPinnedItem[];
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
	/** Per-usage overrides of the `panelSidebarNav` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"panelSidebarNav"> | undefined;
	/** Tooltip of disabled items; defaults to the family's `itemUnavailableTitle`. */
	readonly unavailableTitle?: string | undefined;
	/** App notices shown under the search box (e.g. an enrollment lock). */
	readonly notice?: React.ReactNode;
}

/**
 * The scrolling body of a panel sidebar (web, merchant, admin): the search
 * box, then a `<nav>` landmark with the pinned pages and the menu sections.
 * Presentational — the app owns the menu, the store and the router (it passes
 * `renderLink`). `/` focuses the search box; after each navigation the current
 * page's row is scrolled into view once branch transitions have finished.
 * The ref reaches the scrolling `SidebarContent` element.
 */
export const PanelSidebarNav = React.forwardRef<HTMLDivElement, PanelSidebarNavProps>(function PanelSidebarNav(
	{
		view,
		pathname,
		expandedItems,
		onToggleExpand,
		renderLink,
		renderIcon,
		renderPinnedIcon,
		searchQuery,
		onSearchQueryChange,
		pinnedItems,
		onMoveSectionUp,
		onMoveSectionDown,
		labels: labelsOverride,
		unavailableTitle,
		notice,
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("panelSidebarNav", labelsOverride);
	const closeMobileSidebar = useCloseMobileSidebar();
	const searchInputRef = React.useRef<HTMLInputElement>(null);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const setContainerRef = React.useMemo(() => mergeRefs(containerRef, ref), [ref]);
	const sectionIdPrefix = React.useId();
	useFocusShortcut(searchInputRef, SEARCH_SHORTCUT_KEY);
	useScrollActiveNavItem(containerRef, pathname);

	const context = useNavRowContext(
		view,
		expandedItems,
		onToggleExpand,
		closeMobileSidebar,
		renderLink,
		renderIcon,
		searchQuery,
		unavailableTitle ?? labels.itemUnavailableTitle,
	);
	const showPinned = pinnedItems.length > 0 && !view.noResults;

	return (
		<SidebarContent ref={setContainerRef} className="[overflow-anchor:none]">
			<PanelSidebarSearch
				inputRef={searchInputRef}
				value={searchQuery}
				placeholder={labels.searchPlaceholder}
				ariaLabel={labels.searchAriaLabel}
				clearAriaLabel={labels.clearSearchAriaLabel}
				onValueChange={onSearchQueryChange}
			/>

			{notice}

			{view.noResults ? (
				<div role="status" className="flex flex-col items-center justify-center px-2 py-10 text-center">
					<Search className="mb-2.5 size-7 text-muted-foreground/30" aria-hidden="true" />
					<p className="text-sm text-muted-foreground">{labels.noResultsTitle}</p>
					<p className="mt-1 text-xs text-muted-foreground">{labels.noResultsDescription}</p>
				</div>
			) : null}

			<nav aria-label={labels.navigationAriaLabel}>
				{showPinned ? (
					<>
						<SidebarGroup>
							<SidebarGroupLabel id={`${sectionIdPrefix}-pinned`}>{labels.pinnedSectionTitle}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu className="gap-0.5" aria-labelledby={`${sectionIdPrefix}-pinned`}>
									{pinnedItems.map((pinned) => (
										<PinnedRow key={pinned.url} pinned={pinned} isActive={isRouteActive(pinned.url, pathname)} renderIcon={renderPinnedIcon ?? renderIcon} context={context} />
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
						<SidebarSeparator />
					</>
				) : null}

				{view.sections.map((section, index) => {
					const titleId = `${sectionIdPrefix}-section-${String(index)}`;
					return (
						<SidebarGroup key={section.title}>
							<PanelSidebarSectionHeader
								title={section.title}
								titleId={titleId}
								index={index}
								isLast={index === view.sections.length - 1}
								isSearching={view.isSearching}
								isActiveSection={sectionHasActiveItem(section.items, context.activeItems)}
								allTitles={view.sectionTitles}
								color={section.color}
								moveUpTitle={labels.moveSectionUpTitle}
								moveDownTitle={labels.moveSectionDownTitle}
								moveUpAriaLabel={labels.moveSectionUpAriaLabel(section.title)}
								moveDownAriaLabel={labels.moveSectionDownAriaLabel(section.title)}
								onMoveSectionUp={onMoveSectionUp}
								onMoveSectionDown={onMoveSectionDown}
							/>
							<SidebarGroupContent>
								<SidebarMenu className="gap-0.5" aria-labelledby={titleId}>
									<NavItemList items={section.items} context={context} />
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					);
				})}
			</nav>
		</SidebarContent>
	);
});

export interface PanelSidebarFooterNavProps {
	readonly view: SidebarView;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleExpand: (itemId: string) => void;
	readonly renderLink: PanelSidebarRenderLink;
	readonly renderIcon: PanelSidebarRenderIcon;
	readonly searchQuery: string;
	/** Per-usage overrides of the `panelSidebarNav` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"panelSidebarNav"> | undefined;
	/** Tooltip of disabled items; defaults to the family's `itemUnavailableTitle`. */
	readonly unavailableTitle?: string | undefined;
}

/** The menu's bottom items (account pages) as a second, separately named `<nav>`; renders nothing when there are none. */
export const PanelSidebarFooterNav = React.forwardRef<HTMLElement, PanelSidebarFooterNavProps>(function PanelSidebarFooterNav(
	{ view, expandedItems, onToggleExpand, renderLink, renderIcon, searchQuery, labels: labelsOverride, unavailableTitle },
	ref,
): React.JSX.Element | null {
	const labels = useUiKitLabels("panelSidebarNav", labelsOverride);
	const closeMobileSidebar = useCloseMobileSidebar();
	const context = useNavRowContext(
		view,
		expandedItems,
		onToggleExpand,
		closeMobileSidebar,
		renderLink,
		renderIcon,
		searchQuery,
		unavailableTitle ?? labels.itemUnavailableTitle,
	);
	if (view.bottomItems.length === 0) {
		return null;
	}
	return (
		<nav ref={ref} aria-label={labels.secondaryNavigationAriaLabel}>
			<SidebarMenu className="gap-0.5">
				<NavItemList items={view.bottomItems} context={context} />
			</SidebarMenu>
		</nav>
	);
});

export interface PanelSidebarRouteAnnouncerProps {
	/** The current page's name — the resolved breadcrumb's final label, never a raw URL segment. */
	readonly pageLabel: string | null;
	/** Per-usage overrides of the `panelSidebarNav` family's copy (this part reads `routeAnnouncement`). */
	readonly labels?: UiKitLabelsOverride<"panelSidebarNav"> | undefined;
}

/** Announces client-side navigations to screen readers (a polite live region). */
export const PanelSidebarRouteAnnouncer = React.forwardRef<HTMLDivElement, PanelSidebarRouteAnnouncerProps>(function PanelSidebarRouteAnnouncer(
	{ pageLabel, labels: labelsOverride },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("panelSidebarNav", labelsOverride);
	return (
		<div ref={ref} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
			{pageLabel !== null ? labels.routeAnnouncement(pageLabel) : null}
		</div>
	);
});
