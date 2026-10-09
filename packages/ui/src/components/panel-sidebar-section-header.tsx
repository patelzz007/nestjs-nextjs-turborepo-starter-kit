"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import type { PanelSectionColor } from "@workspace/ui/lib/sidebar/menu-view";
import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";

/** Section dots use the tone palette (packages/tokens), so they theme and meet non-text contrast in both modes. */
const SECTION_COLOR_MAP: Record<PanelSectionColor, string> = {
	blue: "bg-tone-blue",
	green: "bg-tone-green",
	amber: "bg-tone-yellow",
	rose: "bg-tone-red",
	purple: "bg-tone-violet",
	teal: "bg-tone-teal",
};

export interface PanelSidebarSectionHeaderProps {
	readonly title: string;
	/** Id of the title element, so the section's list can be named by it (`aria-labelledby`). */
	readonly titleId?: string;
	readonly index: number;
	readonly isLast: boolean;
	readonly isSearching: boolean;
	readonly isActiveSection: boolean;
	readonly allTitles: readonly string[];
	readonly color?: PanelSectionColor | undefined;
	readonly moveUpTitle: string;
	readonly moveDownTitle: string;
	readonly moveUpAriaLabel: string;
	readonly moveDownAriaLabel: string;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
}

/** Section label with a coloured dot and reorder controls (buttons, or Alt+↑ / Alt+↓ while one is focused). */
export const PanelSidebarSectionHeader = React.forwardRef<HTMLDivElement, PanelSidebarSectionHeaderProps>(function PanelSidebarSectionHeader(
	{
		title,
		titleId,
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
	},
	ref,
): React.JSX.Element {
	const handleMoveUp = React.useCallback((): void => {
		onMoveSectionUp(title, allTitles);
	}, [onMoveSectionUp, title, allTitles]);

	const handleMoveDown = React.useCallback((): void => {
		onMoveSectionDown(title, allTitles);
	}, [onMoveSectionDown, title, allTitles]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLElement>): void => {
			if (!event.altKey) {
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				onMoveSectionUp(title, allTitles);
			}
			if (event.key === "ArrowDown") {
				event.preventDefault();
				onMoveSectionDown(title, allTitles);
			}
		},
		[onMoveSectionUp, onMoveSectionDown, title, allTitles],
	);

	return (
		<div
			ref={ref}
			data-sidebar-section-header="true"
			data-active-section={isActiveSection ? true : undefined}
			className="group/section-header mb-2 flex items-center gap-1 px-2">
			{color !== undefined ? <span className={cn("inline-block size-1.5 shrink-0 rounded-full", SECTION_COLOR_MAP[color])} aria-hidden="true" /> : null}
			<span
				id={titleId}
				title={title}
				className={cn(
					"truncate text-(length:--text-sidebar-section) font-semibold transition-colors duration-200 motion-reduce:transition-none",
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
						onKeyDown={handleKeyDown}
						disabled={index === 0}
						className={cn(index === 0 ? "text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
						title={moveUpTitle}
						aria-label={moveUpAriaLabel}>
						<ArrowUp className="size-3" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleMoveDown}
						onKeyDown={handleKeyDown}
						disabled={isLast}
						className={cn(isLast ? "text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground")}
						title={moveDownTitle}
						aria-label={moveDownAriaLabel}>
						<ArrowDown className="size-3" aria-hidden="true" />
					</Button>
				</div>
			) : null}
		</div>
	);
});
