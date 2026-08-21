"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AlertCircle, ChevronRight, type LucideIcon } from "lucide-react";
import * as React from "react";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { highlightText } from "@/components/common/highlight";
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
}

/** Search-match highlight — token-driven colors via `.sidebar-mark` (audit #17). */
const SIDEBAR_MARK_CLASS = "sidebar-mark rounded-sm px-0.5 font-semibold";

function resolveNavItemState(isActive: boolean, isDisabled: boolean): "active" | "disabled" | "default" {
	if (isActive) {
		return "active";
	}
	if (isDisabled) {
		return "disabled";
	}
	return "default";
}

function SidebarNavItemComponent({ item, isSearching, searchQuery, expandedItems, activeItems, labels, onToggle, onNavigate }: SidebarNavItemProps): React.JSX.Element {
	const itemId = item.id;
	const isDisabled = item.disabled === true;
	const hasChildren = !isDisabled && item.children !== undefined && item.children.length > 0;
	const isExpanded = isSearching ? true : (expandedItems[itemId] ?? false);
	const isActive = activeItems[itemId] ?? false;
	const navState = resolveNavItemState(isActive, isDisabled);
	const IconComponent: LucideIcon = item.icon !== undefined ? (ICON_MAP[item.icon] ?? AlertCircle) : AlertCircle;

	const handleToggle = React.useCallback((): void => {
		onToggle(itemId);
	}, [itemId, onToggle]);

	const handleNavigate = React.useCallback((): void => {
		onNavigate(item.url);
	}, [item.url, onNavigate]);

	return (
		<div className="space-y-0.5">
			<div>
				{hasChildren ? (
					<button type="button" onClick={handleToggle} className={adminSidebarNavItemVariants({ state: navState })} data-active={isActive ? true : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent className={adminSidebarNavIconVariants({ state: navState })} />
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
						<ChevronRight className={adminSidebarNavChevronVariants({ expanded: isExpanded, state: navState })} />
					</button>
				) : (
					<button
						type="button"
						onClick={handleNavigate}
						disabled={isDisabled}
						className={adminSidebarNavItemVariants({ state: navState })}
						data-active={isActive ? true : undefined}
						title={isDisabled ? labels.itemUnavailableTitle : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent className={adminSidebarNavIconVariants({ state: navState })} />
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
					</button>
				)}
			</div>

			{hasChildren ? (
				<div className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
					<div className="min-h-0 overflow-hidden" inert={!isExpanded ? true : undefined}>
						<div
							className={cn(
								"ml-5 border-l border-sidebar-border/80 pl-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
								isExpanded ? "translate-y-0 opacity-100" : "-translate-y-0.5 opacity-0",
							)}>
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
								/>
							))}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}

export const SidebarNavItem = React.memo(SidebarNavItemComponent);
