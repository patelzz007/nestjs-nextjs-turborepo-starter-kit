"use client";

import { Button } from "@workspace/ui/components/form/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

export interface RedemptionsPagerProps {
	/** The page on screen (1-indexed). */
	readonly page: number;
	/** Pages in the log for the selected store. */
	readonly totalPages: number;
	readonly hasPrevious: boolean;
	readonly hasNext: boolean;
	readonly onPrevious: () => void;
	readonly onNext: () => void;
}

/** Previous / next controls for the redemption log. Presentational: the parent owns the page (the URL). */
export function RedemptionsPager({ page, totalPages, hasPrevious, hasNext, onPrevious, onNext }: RedemptionsPagerProps): React.JSX.Element {
	return (
		<nav aria-label="Redemptions pages" className="flex items-center justify-between gap-3 border-t border-border pt-4">
			<Button type="button" variant="outline" disabled={!hasPrevious} onClick={onPrevious} className="gap-1.5">
				<ChevronLeft className="size-4" aria-hidden="true" />
				Previous
			</Button>
			<p className="text-sm text-muted-foreground tabular-nums">{`Page ${String(page)} of ${String(totalPages)}`}</p>
			<Button type="button" variant="outline" disabled={!hasNext} onClick={onNext} className="gap-1.5">
				Next
				<ChevronRight className="size-4" aria-hidden="true" />
			</Button>
		</nav>
	);
}
