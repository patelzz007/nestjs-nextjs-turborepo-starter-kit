"use client";

import { Button } from "@workspace/ui/components/form/button";
import { SidebarMenuBadge, SidebarMenuItem } from "@workspace/ui/components/navigation/sidebar";
import { AlertCircle, ChevronRight } from "lucide-react";
import * as React from "react";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { highlightText } from "@/components/common/highlight";
import { SidebarNavCollapse } from "@/components/layout/sidebar/sidebar-nav-collapse";
import type { CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";
import type { AdminSidebarLabels } from "@/lib/sidebar-labels";
import { adminSidebarNavChevronVariants, adminSidebarNavIconVariants, adminSidebarNavItemVariants } from "@workspace/ui/lib/admin-sidebar-nav-variants";

export interface SidebarNavItemProps {
	readonly item: CompiledSidebarMenuItem;
	readonly isSearching: boolean;
	readonly searchQuery: string;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly labels: AdminSidebarLabels;
	readonly onToggle: (itemId: string) => void;
	readonly onNavigate: (href: string) => void;
	readonly depth?: number;
}

const SIDEBAR_MARK_CLASS = "sidebar-mark rounded-sm px-0.5 font-semibold";

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

function renderNavIcon(iconName: string | undefined, state: NavRowState): React.ReactNode {
	const Icon = iconName !== undefined ? (ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={adminSidebarNavIconVariants({ state })} />;
}

function SidebarNavBranch({ open, children }: { readonly open: boolean; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<SidebarNavCollapse open={open}>
			<div className="ml-5 border-l border-sidebar-border/80 pl-2">{children}</div>
		</SidebarNavCollapse>
	);
}

function SidebarNavItemComponent({
	item,
	isSearching,
	searchQuery,
	expandedItems,
	activeItems,
	labels,
	onToggle,
	onNavigate,
	depth = 0,
}: SidebarNavItemProps): React.JSX.Element {
	const itemId = item.id;
	const isDisabled = item.disabled === true;
	const hasChildren = !isDisabled && item.children !== undefined && item.children.length > 0;
	const isExpanded = isSearching ? true : (expandedItems[itemId] ?? false);
	const isActive = activeItems[itemId] ?? false;
	const navState = resolveNavRowState(isActive, isDisabled);
	const title = React.useMemo(() => highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS), [item.title, searchQuery]);

	const handleToggle = React.useCallback((): void => {
		onToggle(itemId);
	}, [itemId, onToggle]);

	const handleNavigate = React.useCallback((): void => {
		onNavigate(item.url);
	}, [item.url, onNavigate]);

	const rowButton = hasChildren ? (
		<Button type="button" variant="nav" onClick={handleToggle} className={adminSidebarNavItemVariants({ state: navState })} data-active={isActive ? true : undefined}>
			<span className="flex min-w-0 items-center">
				{renderNavIcon(item.icon, navState)}
				<span className="truncate">{title}</span>
			</span>
			<ChevronRight className={adminSidebarNavChevronVariants({ expanded: isExpanded, state: navState })} />
		</Button>
	) : (
		<Button
			type="button"
			variant="nav"
			onClick={handleNavigate}
			disabled={isDisabled}
			className={adminSidebarNavItemVariants({ state: navState })}
			data-active={isActive ? true : undefined}
			title={isDisabled ? labels.itemUnavailableTitle : undefined}>
			<span className="flex min-w-0 items-center">
				{renderNavIcon(item.icon, navState)}
				<span className="truncate">{title}</span>
			</span>
		</Button>
	);

	const childBranch = hasChildren ? (
		<SidebarNavBranch open={isExpanded}>
			{item.children.map((childItem) => (
				<SidebarNavItem
					key={childItem.id}
					item={childItem}
					isSearching={isSearching}
					searchQuery={searchQuery}
					expandedItems={expandedItems}
					activeItems={activeItems}
					labels={labels}
					onToggle={onToggle}
					onNavigate={onNavigate}
					depth={depth + 1}
				/>
			))}
		</SidebarNavBranch>
	) : null;

	const content = (
		<div className="space-y-0.5">
			{rowButton}
			{depth === 0 ? <SidebarMenuBadge itemId={itemId} /> : null}
			{childBranch}
		</div>
	);

	if (depth === 0) {
		return <SidebarMenuItem>{content}</SidebarMenuItem>;
	}

	return content;
}

export const SidebarNavItem = React.memo(SidebarNavItemComponent);
