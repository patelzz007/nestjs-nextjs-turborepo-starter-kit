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
	/** True when this section contains the currently active route (audit #16). */
	readonly isActiveSection: boolean;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
}

/**
 * Section header. Designed the way a human would lay out a nav: a plain
 * sentence-case label in a quiet gray, with generous spacing — no uppercase,
 * no tracking, no hairline divider, no accent bars (audit #16, third pass).
 * Sections are separated by whitespace, which is how real apps group nav.
 *
 * The active section is signalled by the gentlest possible cue: the label
 * simply brightens to the foreground color. The active *item* underneath is
 * the loud signal; the group label only whispers.
 *
 * The reorder controls stay hidden until hover OR keyboard focus (audit #10 —
 * hover-only made them unreachable on touch and invisible to keyboard users).
 * While either button has focus, `Alt+↑` / `Alt+↓` also move the section.
 */
export function SidebarSectionHeader({
	title,
	index,
	isLast,
	isSearching,
	allTitles,
	isActiveSection,
	onMoveSectionUp,
	onMoveSectionDown,
}: SidebarSectionHeaderProps): React.JSX.Element {
	const handleMoveUp = React.useCallback((): void => {
		onMoveSectionUp(title, allTitles);
	}, [onMoveSectionUp, title, allTitles]);

	const handleMoveDown = React.useCallback((): void => {
		onMoveSectionDown(title, allTitles);
	}, [onMoveSectionDown, title, allTitles]);

	// Alt+↑ / Alt+↓ works from either reorder button (whichever the keyboard
	// user landed on — the buttons are the only focusable parts of the header).
	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>): void => {
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
		<div data-sidebar-section-header="true" data-active-section={isActiveSection ? true : undefined} className="group/section-header mb-2 flex items-center gap-1 px-2">
			<span className={cn("truncate text-[13px] font-semibold transition-colors duration-200", isActiveSection ? "text-sidebar-foreground" : "text-muted-foreground")}>
				{title}
			</span>

			{!isSearching ? (
				<div className="ml-auto flex items-center gap-0.5 opacity-0 transition-all duration-200 group-focus-within/section-header:opacity-100 group-hover/section-header:opacity-100">
					<button
						type="button"
						onClick={handleMoveUp}
						onKeyDown={handleKeyDown}
						disabled={index === 0}
						className={cn(
							"rounded p-0.5 transition-colors",
							index === 0 ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
						)}
						title="Move section up (Alt+↑)"
						aria-label={`Move ${title} section up`}>
						<ArrowUp className="h-3 w-3" />
					</button>
					<button
						type="button"
						onClick={handleMoveDown}
						onKeyDown={handleKeyDown}
						disabled={isLast}
						className={cn(
							"rounded p-0.5 transition-colors",
							isLast ? "cursor-not-allowed text-muted-foreground/25" : "text-muted-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
						)}
						title="Move section down (Alt+↓)"
						aria-label={`Move ${title} section down`}>
						<ArrowDown className="h-3 w-3" />
					</button>
				</div>
			) : null}
		</div>
	);
}
