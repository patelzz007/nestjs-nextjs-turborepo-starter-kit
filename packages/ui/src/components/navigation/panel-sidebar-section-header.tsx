"use client";

import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";

export type PanelSectionColor = "blue" | "green" | "amber" | "rose" | "purple" | "teal";

const SECTION_COLOR_MAP: Record<PanelSectionColor, string> = {
	blue: "bg-blue-500",
	green: "bg-emerald-500",
	amber: "bg-amber-500",
	rose: "bg-rose-500",
	purple: "bg-purple-500",
	teal: "bg-teal-500",
};

export interface PanelSidebarSectionHeaderProps {
	readonly title: string;
	readonly index: number;
	readonly isLast: boolean;
	readonly isSearching: boolean;
	readonly isActiveSection: boolean;
	readonly allTitles: readonly string[];
	readonly color?: PanelSectionColor;
	readonly moveUpTitle: string;
	readonly moveDownTitle: string;
	readonly moveUpAriaLabel: string;
	readonly moveDownAriaLabel: string;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
}

/** Admin-style section label with colored dot and optional reorder controls. */
export function PanelSidebarSectionHeader({
	title,
	index,
	isLast,
	isSearching,
	isActiveSection,
	allTitles,
	color,
	moveUpTitle,
	moveDownTitle,
	moveUpAriaLabel,
	moveDownAriaLabel,
	onMoveSectionUp,
	onMoveSectionDown,
}: PanelSidebarSectionHeaderProps): React.JSX.Element {
	const handleMoveUp = React.useCallback((): void => {
		onMoveSectionUp(title, allTitles);
	}, [onMoveSectionUp, title, allTitles]);

	const handleMoveDown = React.useCallback((): void => {
		onMoveSectionDown(title, allTitles);
	}, [onMoveSectionDown, title, allTitles]);

	return (
		<div data-sidebar-section-header="true" data-active-section={isActiveSection ? true : undefined} className="group/section-header mb-2 flex items-center gap-1 px-2">
			{color !== undefined ? <span className={cn("inline-block size-1.5 shrink-0 rounded-full", SECTION_COLOR_MAP[color])} aria-hidden="true" /> : null}
			<span
				className={cn(
					"truncate text-[length:var(--text-sidebar-section)] font-semibold transition-colors duration-200 motion-reduce:transition-none",
					isActiveSection ? "text-sidebar-foreground" : "text-muted-foreground",
				)}>
				{title}
			</span>

			{!isSearching ? (
				<div className="ml-auto flex items-center gap-0.5 opacity-0 transition-all duration-200 group-focus-within/section-header:opacity-100 group-hover/section-header:opacity-100">
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleMoveUp}
						disabled={index === 0}
						className={cn(index === 0 ? "text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
						title={moveUpTitle}
						aria-label={moveUpAriaLabel}>
						<ArrowUp className="h-3 w-3" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleMoveDown}
						disabled={isLast}
						className={cn(isLast ? "text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
						title={moveDownTitle}
						aria-label={moveDownAriaLabel}>
						<ArrowDown className="h-3 w-3" aria-hidden="true" />
					</Button>
				</div>
			) : null}
		</div>
	);
}
