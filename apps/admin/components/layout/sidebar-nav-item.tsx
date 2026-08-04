"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AlertCircle, ChevronRight, type LucideIcon } from "lucide-react";
import * as React from "react";

import { ICON_MAP } from "@/config/menu-icons";
import { createItemId } from "@/lib/menu";
import { highlightText } from "@/lib/highlight";
import type { SidebarMenuItem } from "@/types/sidebar";

export interface SidebarNavItemProps {
	readonly item: SidebarMenuItem;
	readonly parentId: string;
	readonly isSearching: boolean;
	readonly searchQuery: string;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly onToggle: (itemId: string) => void;
	readonly onNavigate: (href: string) => void;
}

const SIDEBAR_MARK_CLASS = "rounded-sm bg-blue-500/15 px-0.5 font-semibold text-blue-700 ring-1 ring-blue-500/20 dark:text-blue-300";

/** Recursive renderer for a single nav item and all of its children. */
export function SidebarNavItem({ item, parentId, isSearching, searchQuery, expandedItems, activeItems, onToggle, onNavigate }: SidebarNavItemProps): React.JSX.Element {
	const itemId = createItemId(item, parentId);
	const hasChildren = item.children !== undefined && item.children.length > 0;
	const isExpanded = isSearching ? true : (expandedItems[itemId] ?? false);
	const isActive = activeItems[itemId] ?? false;
	const isDisabled = item.disabled === true;
	// Direct module-scope map lookup (not a function call) so the component
	// reference is static — satisfies `react-hooks/static-components`.
	const IconComponent: LucideIcon = item.icon !== undefined ? (ICON_MAP[item.icon] ?? AlertCircle) : AlertCircle;

	const handleToggle = React.useCallback((): void => {
		onToggle(itemId);
	}, [itemId, onToggle]);

	const handleNavigate = React.useCallback((): void => {
		onNavigate(item.url);
	}, [item.url, onNavigate]);

	const buttonClassName = cn(
		"flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-200",
		"focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/40 focus-visible:ring-offset-1",
		isActive
			? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
			: isDisabled
				? "cursor-not-allowed text-muted-foreground opacity-50"
				: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
	);

	return (
		<div className="space-y-0.5">
			<div>
				{hasChildren ? (
					<button
						type="button"
						onClick={handleToggle}
						disabled={isDisabled}
						className={buttonClassName}
						title={isDisabled ? "This feature is currently unavailable" : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent
								className={cn("mr-3 h-4 w-4 shrink-0", isActive ? "text-sidebar-primary-foreground" : isDisabled ? "text-muted-foreground" : "text-sidebar-foreground/50")}
							/>
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
						<ChevronRight
							className={cn(
								"h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out",
								isExpanded ? "rotate-90 text-sidebar-foreground/60" : "text-sidebar-foreground/40",
							)}
						/>
					</button>
				) : (
					<button
						type="button"
						onClick={handleNavigate}
						disabled={isDisabled}
						className={buttonClassName}
						title={isDisabled ? "This feature is currently unavailable" : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent
								className={cn("mr-3 h-4 w-4 shrink-0", isActive ? "text-sidebar-primary-foreground" : isDisabled ? "text-muted-foreground" : "text-sidebar-foreground/50")}
							/>
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
					</button>
				)}
			</div>

			{hasChildren ? (
				<div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
					<div className="min-h-0 overflow-hidden">
						<div className="ml-5 border-l border-sidebar-border/80 pl-2">
							{item.children.map((childItem) => (
								<SidebarNavItem
									key={createItemId(childItem, itemId)}
									item={childItem}
									parentId={itemId}
									isSearching={isSearching}
									searchQuery={searchQuery}
									expandedItems={expandedItems}
									activeItems={activeItems}
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
