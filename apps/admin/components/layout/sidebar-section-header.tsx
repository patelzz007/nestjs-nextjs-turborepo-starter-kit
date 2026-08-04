"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";

import { cn } from "@workspace/ui/lib/utils";

export interface SidebarSectionHeaderProps {
	readonly title: string;
	readonly index: number;
	readonly isLast: boolean;
	readonly isSearching: boolean;
	readonly allTitles: readonly string[];
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
}

/** Section header with hover-to-reveal reorder controls. */
export function SidebarSectionHeader({ title, index, isLast, isSearching, allTitles, onMoveSectionUp, onMoveSectionDown }: SidebarSectionHeaderProps): React.JSX.Element {
	const handleMoveUp = React.useCallback((): void => {
		onMoveSectionUp(title, allTitles);
	}, [onMoveSectionUp, title, allTitles]);

	const handleMoveDown = React.useCallback((): void => {
		onMoveSectionDown(title, allTitles);
	}, [onMoveSectionDown, title, allTitles]);

	return (
		<div className="group/section-header mb-1.5 flex items-center gap-1 px-2">
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="truncate text-[11px] font-semibold tracking-wider text-sidebar-foreground/45 uppercase select-none">{title}</span>
				<div className="h-px flex-1 bg-sidebar-border/30" />
			</div>

			{!isSearching ? (
				<div className="flex items-center gap-0.5 opacity-0 transition-all duration-200 group-hover/section-header:opacity-100">
					<div className="mr-1 flex items-center gap-0.5 border-r border-sidebar-border/20 pr-1">
						<button
							type="button"
							onClick={handleMoveUp}
							disabled={index === 0}
							className={cn(
								"rounded p-0.5 transition-colors",
								index === 0 ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
							)}
							title="Move section up"
							aria-label={`Move ${title} section up`}>
							<ArrowUp className="h-3 w-3" />
						</button>
						<button
							type="button"
							onClick={handleMoveDown}
							disabled={isLast}
							className={cn(
								"rounded p-0.5 transition-colors",
								isLast ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
							)}
							title="Move section down"
							aria-label={`Move ${title} section down`}>
							<ArrowDown className="h-3 w-3" />
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
