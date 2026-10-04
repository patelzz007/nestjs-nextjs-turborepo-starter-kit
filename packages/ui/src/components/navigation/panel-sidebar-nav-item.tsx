"use client";

import { SidebarMenu, SidebarMenuBadge, SidebarMenuItem } from "@workspace/ui/components/navigation/sidebar";
import { highlightText } from "@workspace/ui/lib/core/highlight-text";
import { cn } from "@workspace/ui/lib/core/utils";
import type { SidebarMenuItemLike } from "@workspace/ui/lib/sidebar/menu-view";
import { panelSidebarNavChevronVariants, panelSidebarNavIconVariants, panelSidebarNavItemVariants } from "@workspace/ui/lib/sidebar/panel-nav-variants";
import { ChevronRight } from "lucide-react";
import * as React from "react";

const SIDEBAR_MARK_CLASS = "search-mark rounded-sm px-0.5 font-semibold";

/** The props a panel sidebar sets on the app's link element (a Next.js `<Link>` or a plain `<a>`). */
export type PanelSidebarLinkProps = Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "title" | "onClick" | "aria-current" | "children">;

/**
 * Returns the app's BARE link element for `href` (e.g. `<Link href={href} />`);
 * the sidebar adds the styling, state and content. Keeps this package free of
 * any router.
 */
export type PanelSidebarRenderLink = (href: string) => React.ReactElement<PanelSidebarLinkProps>;

/** Renders a menu icon by name — the icon map is the app's. */
export type PanelSidebarRenderIcon = (iconName: string | undefined, className: string) => React.ReactNode;

export interface PanelSidebarNavItemProps {
	readonly item: SidebarMenuItemLike;
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleExpand: (itemId: string) => void;
	/** Runs when a link is followed (e.g. closes the mobile drawer). Navigation itself is the link's. */
	readonly onNavigate?: (() => void) | undefined;
	readonly renderLink: PanelSidebarRenderLink;
	readonly renderIcon: PanelSidebarRenderIcon;
	readonly searchQuery: string;
	readonly isSearching: boolean;
	/** Tooltip + accessible description of a disabled item. */
	readonly unavailableTitle: string;
	readonly depth?: number;
}

type NavRowState = "active" | "disabled" | "default";

function resolveNavRowState(isActive: boolean, isDisabled: boolean): NavRowState {
	if (isActive) {
		return "active";
	}
	if (isDisabled) {
		return "disabled";
	}
	return "default";
}

/** Height collapse for a nested branch — children stay mounted (and `inert` while closed) so open/close animates. */
export function PanelSidebarNavCollapse({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="grid w-full transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
			<div className="min-h-0 w-full overflow-hidden [overflow-anchor:none]" inert={!open ? true : undefined}>
				<div
					className={cn(
						"w-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
						open ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0",
					)}>
					{children}
				</div>
			</div>
		</div>
	);
}

/**
 * One row of a panel sidebar's nav tree (web, merchant, admin).
 *
 * - A **leaf** that leads somewhere is the app's link (`renderLink`) with
 *   `aria-current="page"` when it is the current page — so it can be opened in
 *   a new tab, and is announced as a link.
 * - A **branch** is a disclosure button (`aria-expanded`, `aria-controls`) for
 *   its nested list (`role="group"`).
 * - A **disabled** item is announced as an unavailable link
 *   (`aria-disabled`), stays focusable so its explanation can be read, and
 *   never navigates or toggles.
 * - Labels truncate visually; the full title is always the row's `title`.
 */
export function PanelSidebarNavItem({
	item,
	activeItems,
	expandedItems,
	onToggleExpand,
	onNavigate,
	renderLink,
	renderIcon,
	searchQuery,
	isSearching,
	unavailableTitle,
	depth = 0,
}: PanelSidebarNavItemProps): React.JSX.Element {
	const groupId = React.useId();
	const descriptionId = React.useId();
	const children = item.children ?? [];
	const hasChildren = children.length > 0;
	const isDisabled = item.disabled === true;
	const isActive = activeItems[item.id] === true;
	const isExpanded = isSearching || expandedItems[item.id] === true;
	const navState = resolveNavRowState(isActive, isDisabled);
	const rowClassName = panelSidebarNavItemVariants({ state: navState });
	const highlightedTitle = React.useMemo(() => highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS), [item.title, searchQuery]);

	const handleToggle = React.useCallback((): void => {
		if (!isDisabled) {
			onToggleExpand(item.id);
		}
	}, [isDisabled, item.id, onToggleExpand]);

	const handleFollowLink = React.useCallback((): void => {
		onNavigate?.();
	}, [onNavigate]);

	const label = (
		<span className="flex min-w-0 items-center">
			{renderIcon(item.icon, panelSidebarNavIconVariants({ state: navState }))}
			<span className="truncate">{highlightedTitle}</span>
		</span>
	);

	let row: React.ReactNode;
	if (hasChildren) {
		row = (
			<button
				type="button"
				onClick={handleToggle}
				className={rowClassName}
				aria-expanded={isExpanded}
				aria-controls={groupId}
				aria-disabled={isDisabled ? true : undefined}
				data-active={isActive ? true : undefined}
				title={isDisabled ? unavailableTitle : item.title}>
				{label}
				<ChevronRight className={panelSidebarNavChevronVariants({ expanded: isExpanded, state: navState })} aria-hidden="true" />
			</button>
		);
	} else if (isDisabled || item.url === "#") {
		row = (
			<span role="link" aria-disabled="true" aria-describedby={descriptionId} tabIndex={0} className={rowClassName} title={unavailableTitle}>
				{label}
				<span id={descriptionId} hidden>
					{unavailableTitle}
				</span>
			</span>
		);
	} else {
		row = React.cloneElement(
			renderLink(item.url),
			{
				className: rowClassName,
				title: item.title,
				onClick: handleFollowLink,
				"aria-current": isActive ? "page" : undefined,
			},
			label,
		);
	}

	return (
		<SidebarMenuItem>
			<div className="space-y-0.5">
				{row}
				{depth === 0 ? <SidebarMenuBadge itemId={item.id} /> : null}
				{hasChildren ? (
					<PanelSidebarNavCollapse open={isExpanded}>
						<SidebarMenu id={groupId} role="group" aria-label={item.title} className="ml-5 gap-0.5 border-l border-sidebar-border/80 pl-2">
							{children.map((child) => (
								<PanelSidebarNavItem
									key={child.id}
									item={child}
									activeItems={activeItems}
									expandedItems={expandedItems}
									onToggleExpand={onToggleExpand}
									onNavigate={onNavigate}
									renderLink={renderLink}
									renderIcon={renderIcon}
									searchQuery={searchQuery}
									isSearching={isSearching}
									unavailableTitle={unavailableTitle}
									depth={depth + 1}
								/>
							))}
						</SidebarMenu>
					</PanelSidebarNavCollapse>
				) : null}
			</div>
		</SidebarMenuItem>
	);
}
