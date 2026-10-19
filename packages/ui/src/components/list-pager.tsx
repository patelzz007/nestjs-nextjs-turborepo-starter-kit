"use client";

import { Button } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

/** The `listPager` family of `UiKitLabels`. */
export interface ListPagerLabels {
	/** Accessible name of the pager `<nav>` landmark — name the list when a page has more than one ("Device pages"). */
	readonly ariaLabel: string;
	readonly previous: string;
	readonly next: string;
	/** Where the list is: "Page 2 of 5", or "Page 2" while the total is unknown (`totalPages` null). */
	readonly position: (page: number, totalPages: number | null) => string;
}

export interface ListPagerProps extends Omit<React.ComponentProps<"nav">, "children"> {
	/** The page on screen (1-indexed). */
	readonly page: number;
	/** Pages in the list (the API's `meta.totalPages`), or `null` when not known. */
	readonly totalPages: number | null;
	readonly hasPrevious: boolean;
	readonly hasNext: boolean;
	readonly onPrevious: () => void;
	readonly onNext: () => void;
	/** Disables both buttons while a page loads, so a double click never skips a page. */
	readonly disabled?: boolean | undefined;
	/** Per-usage copy override (usually just `ariaLabel`). */
	readonly labels?: UiKitLabelsOverride<"listPager"> | undefined;
}

/**
 * Previous / next controls under a paginated list (the API's list grammar, docs/technical/api/list-queries.md).
 * Presentational and controlled: the parent owns the page (usually URL state) and moves it in `onPrevious` /
 * `onNext`; this only renders the position and the two buttons.
 */
export const ListPager = React.forwardRef<HTMLElement, ListPagerProps>(function ListPager(
	{ page, totalPages, hasPrevious, hasNext, onPrevious, onNext, disabled = false, labels: labelsOverride, className, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("listPager", labelsOverride);
	return (
		<nav
			ref={ref}
			aria-label={labels.ariaLabel}
			data-slot="list-pager"
			className={cn("flex items-center justify-between gap-3 border-t border-border pt-4", className)}
			{...props}>
			<Button type="button" variant="outline" disabled={disabled || !hasPrevious} onClick={onPrevious} className="gap-1.5">
				<ChevronLeft className="size-4" aria-hidden="true" />
				{labels.previous}
			</Button>
			<p className="text-sm text-muted-foreground tabular-nums">{labels.position(page, totalPages)}</p>
			<Button type="button" variant="outline" disabled={disabled || !hasNext} onClick={onNext} className="gap-1.5">
				{labels.next}
				<ChevronRight className="size-4" aria-hidden="true" />
			</Button>
		</nav>
	);
});
ListPager.displayName = "ListPager";
