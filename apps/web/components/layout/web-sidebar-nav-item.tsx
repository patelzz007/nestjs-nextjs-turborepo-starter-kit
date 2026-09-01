"use client";

import { WebSidebarNavCollapse } from "@/components/layout/web-sidebar-nav-collapse";
import { WEB_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";
import { SidebarMenuBadge, SidebarMenuItem } from "@workspace/ui/components/navigation/sidebar";
import { Button } from "@workspace/ui/components/form/button";
import { highlightText } from "@workspace/ui/lib/highlight-text";
import { panelSidebarNavChevronVariants, panelSidebarNavIconVariants, panelSidebarNavItemVariants } from "@workspace/ui/lib/panel-sidebar-nav-variants";
import { AlertCircle, ChevronRight } from "lucide-react";
import * as React from "react";

const SIDEBAR_MARK_CLASS = "sidebar-mark rounded-sm px-0.5 font-semibold";

export interface WebSidebarNavItemProps {
	readonly item: CompiledSidebarMenuItem;
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleExpand: (itemId: string) => void;
	readonly onNavigate: (href: string) => void;
	readonly searchQuery?: string;
	readonly isSearching?: boolean;
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

function resolveMenuIcon(iconName: string | undefined, state: NavRowState): React.ReactNode {
	const Icon = iconName !== undefined ? (WEB_MENU_ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={panelSidebarNavIconVariants({ state })} aria-hidden="true" />;
}

export function WebSidebarNavItem({
	item,
	activeItems,
	expandedItems,
	onToggleExpand,
	onNavigate,
	searchQuery = "",
	isSearching = false,
	depth = 0,
}: WebSidebarNavItemProps): React.JSX.Element {
	const hasChildren = item.children !== undefined && item.children.length > 0;
	const isDisabled = item.disabled === true;
	const isActive = activeItems[item.id] === true;
	const isExpanded = isSearching ? true : (expandedItems[item.id] ?? false);
	const navState = resolveNavRowState(isActive, isDisabled);
	const title = React.useMemo(() => highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS), [item.title, searchQuery]);

	const handleToggleExpand = React.useCallback((): void => {
		if (!isDisabled) {
			onToggleExpand(item.id);
		}
	}, [isDisabled, item.id, onToggleExpand]);

	const handleNavigate = React.useCallback((): void => {
		if (!isDisabled && item.url !== "#") {
			onNavigate(item.url);
		}
	}, [isDisabled, item.url, onNavigate]);

	const rowButton = hasChildren ? (
		<Button
			type="button"
			variant="nav"
			onClick={handleToggleExpand}
			className={panelSidebarNavItemVariants({ state: navState })}
			data-active={isActive ? true : undefined}
			title={isDisabled ? "This feature is currently unavailable" : undefined}>
			<span className="flex min-w-0 items-center">
				{resolveMenuIcon(item.icon, navState)}
				<span className="truncate">{title}</span>
			</span>
			<ChevronRight className={panelSidebarNavChevronVariants({ expanded: isExpanded, state: navState })} aria-hidden="true" />
		</Button>
	) : (
		<Button
			type="button"
			variant="nav"
			onClick={handleNavigate}
			disabled={isDisabled}
			className={panelSidebarNavItemVariants({ state: navState })}
			data-active={isActive ? true : undefined}
			title={isDisabled ? "This feature is currently unavailable" : undefined}>
			<span className="flex min-w-0 items-center">
				{resolveMenuIcon(item.icon, navState)}
				<span className="truncate">{title}</span>
			</span>
		</Button>
	);

	const childBranch = hasChildren ? (
		<WebSidebarNavCollapse open={isExpanded}>
			<div className="ml-5 border-l border-sidebar-border/80 pl-2">
				{item.children.map((child) => (
					<WebSidebarNavItem
						key={child.id}
						item={child}
						activeItems={activeItems}
						expandedItems={expandedItems}
						onToggleExpand={onToggleExpand}
						onNavigate={onNavigate}
						searchQuery={searchQuery}
						isSearching={isSearching}
						depth={depth + 1}
					/>
				))}
			</div>
		</WebSidebarNavCollapse>
	) : null;

	const content = (
		<div className="space-y-0.5">
			{rowButton}
			{depth === 0 ? <SidebarMenuBadge itemId={item.id} /> : null}
			{childBranch}
		</div>
	);

	if (depth === 0) {
		return <SidebarMenuItem>{content}</SidebarMenuItem>;
	}

	return content;
}
