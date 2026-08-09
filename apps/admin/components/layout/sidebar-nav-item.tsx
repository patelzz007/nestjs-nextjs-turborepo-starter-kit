"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AlertCircle, ChevronRight, type LucideIcon } from "lucide-react";
import * as React from "react";

import { ICON_MAP } from "@/config/menu-icons";
import { highlightText } from "@/lib/highlight";
import type { CompiledSidebarMenuItem } from "@/types/sidebar";

export interface SidebarNavItemProps {
	readonly item: CompiledSidebarMenuItem;
	readonly isSearching: boolean;
	readonly searchQuery: string;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly activeItems: Readonly<Record<string, boolean>>;
	readonly onToggle: (itemId: string) => void;
	readonly onNavigate: (href: string) => void;
}

/** Search-match highlight — token-driven colors via `.sidebar-mark` (audit #17). */
const SIDEBAR_MARK_CLASS = "sidebar-mark rounded-sm px-0.5 font-semibold";

/**
 * Recursive renderer for a single nav item and all of its children. Item
 * identity comes from the compiled `item.id` (globally unique — audit #7), so
 * expansion/active maps and React keys can never collide across same-titled
 * items.
 */
export function SidebarNavItem({ item, isSearching, searchQuery, expandedItems, activeItems, onToggle, onNavigate }: SidebarNavItemProps): React.JSX.Element {
	const itemId = item.id;
	const isDisabled = item.disabled === true;
	// Disabled parents never render their children (audit #14) — a disabled
	// feature shouldn't leak its subtree into the tab order / reader flow.
	const hasChildren = !isDisabled && item.children !== undefined && item.children.length > 0;
	const isExpanded = isSearching ? true : (expandedItems[itemId] ?? false);
	const isActive = activeItems[itemId] ?? false;
	// Direct module-scope map lookup (not a function call) so the component
	// reference is static — satisfies `react-hooks/static-components`.
	const IconComponent: LucideIcon = item.icon !== undefined ? (ICON_MAP[item.icon] ?? AlertCircle) : AlertCircle;

	const handleToggle = React.useCallback((): void => {
		onToggle(itemId);
	}, [itemId, onToggle]);

	const handleNavigate = React.useCallback((): void => {
		onNavigate(item.url);
	}, [item.url, onNavigate]);

	// Hover/active treatment:
	// - hover is a *soft* tint (60%) with the label brightening,
	// - active is a *solid* pill — `slate-800` on light / `white` on dark,
	//   driven by the `--sidebar-primary` / `--sidebar-primary-foreground`
	//   tokens (themeable, never hardcoded),
	// - a barely-there press-down (`active:scale-[0.99]`) for tactile feedback.
	const buttonClassName = cn(
		"group flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-[background-color,color,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
		isActive
			? // The focus ring inverts with the pill: the default gray ring would
				// vanish against a dark slate fill, so focus uses the foreground.
				"bg-sidebar-primary font-medium text-sidebar-primary-foreground focus-visible:ring-sidebar-primary-foreground/50 active:scale-[0.99]"
			: isDisabled
				? "cursor-not-allowed text-muted-foreground opacity-50"
				: "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring/40 active:scale-[0.99]",
	);

	// Icons stay quiet until the row is hovered or active — then they take the
	// pill foreground (white on slate-800 / slate-800 on white), which is the
	// cue the eye reads first.
	const iconClassName = cn(
		"mr-3 h-4 w-4 shrink-0 transition-colors duration-200",
		isActive ? "text-sidebar-primary-foreground" : isDisabled ? "text-muted-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80",
	);

	// The chevron is a quiet /40 whisper until the row is hovered (usable) or
	// expanded (rotated 90°, one step brighter). Active parents invert to the
	// pill foreground so the whole row reads as one unit.
	const chevronClassName = cn(
		"h-3.5 w-3.5 shrink-0 transition-[transform,color] duration-200 ease-out",
		isExpanded
			? isActive
				? "rotate-90 text-sidebar-primary-foreground/80"
				: "rotate-90 text-sidebar-foreground/70"
			: "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70",
	);

	return (
		<div className="space-y-0.5">
			<div>
				{hasChildren ? (
					<button type="button" onClick={handleToggle} className={buttonClassName} data-active={isActive ? true : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent className={iconClassName} />
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
						<ChevronRight className={chevronClassName} />
					</button>
				) : (
					<button
						type="button"
						onClick={handleNavigate}
						disabled={isDisabled}
						className={buttonClassName}
						data-active={isActive ? true : undefined}
						title={isDisabled ? "This feature is currently unavailable" : undefined}>
						<span className="flex min-w-0 items-center">
							<IconComponent className={iconClassName} />
							<span className="truncate">{highlightText(item.title, searchQuery, SIDEBAR_MARK_CLASS)}</span>
						</span>
					</button>
				)}
			</div>

			{hasChildren ? (
				<div className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}>
					{/* `inert` while collapsed: hidden children can't be Tab'd into or
					    read by screen readers (a11y). The CSS animation still runs
					    — inert only removes them from focus/AT, not from paint. */}
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
