"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { useDebouncedDraft } from "@workspace/ui/hooks/use-debounced-draft";
import { Search, X } from "lucide-react";
import * as React from "react";

/** Typing pauses this long before the sidebar filters (a filter per keystroke would re-render the whole tree). */
export const PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS = 150;

export interface PanelSidebarSearchProps {
	/** The committed search text (the sidebar store's). */
	readonly value: string;
	readonly placeholder: string;
	readonly ariaLabel: string;
	readonly clearAriaLabel: string;
	/** Commits the text — debounced while typing, immediately on clear. Keep it stable (a store command). */
	readonly onValueChange: (value: string) => void;
	readonly inputRef?: React.RefObject<HTMLInputElement | null>;
	readonly className?: string;
}

/**
 * Inset sidebar search with a `/` keyboard hint when empty. The input shows a
 * local draft (so typing stays instant) committed after a pause; the draft
 * follows the committed value whenever it changes elsewhere, and the clear
 * button commits at once — cancelling any commit still pending. The ref
 * reaches the wrapper `<div>`; `inputRef` reaches the input.
 */
export const PanelSidebarSearch = React.forwardRef<HTMLDivElement, PanelSidebarSearchProps>(function PanelSidebarSearch(
	{ value, placeholder, ariaLabel, clearAriaLabel, onValueChange, inputRef, className },
	ref,
): React.JSX.Element {
	const { draft: localValue, setDraft, commitNow } = useDebouncedDraft({ value, onCommit: onValueChange, delayMs: PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS });

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setDraft(event.target.value);
		},
		[setDraft],
	);

	const handleClear = React.useCallback((): void => {
		commitNow("");
		inputRef?.current?.focus();
	}, [commitNow, inputRef]);

	const hasQuery = localValue.length > 0;

	return (
		<div ref={ref} data-slot="panel-sidebar-search" className={cn("p-3", className)}>
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden="true" />
				<Input
					ref={inputRef}
					type="text"
					role="searchbox"
					placeholder={placeholder}
					value={localValue}
					onChange={handleChange}
					aria-label={ariaLabel}
					className={cn(
						"h-9 w-full rounded-lg border-0 bg-sidebar-accent/60 pl-9 text-sm shadow-none ring-1 ring-sidebar-foreground/10 ring-inset",
						"placeholder:text-muted-foreground/60",
						"focus-visible:bg-sidebar-accent focus-visible:ring-sidebar-ring/45",
						hasQuery ? "pr-9" : "pr-10",
					)}
				/>
				{hasQuery ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleClear}
						className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
						aria-label={clearAriaLabel}>
						<X className="size-3.5" />
					</Button>
				) : (
					<kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-sidebar-border bg-sidebar/90 px-1.5 font-mono text-(length:--text-kbd) font-medium text-muted-foreground/70 sm:inline">
						/
					</kbd>
				)}
			</div>
		</div>
	);
});
