"use client";

// What DataTable shows in place of rows: the error, the empty table, and "nothing matches your filters".

import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import type { DataTableLabels } from "@workspace/ui-kit-logic";
import { CircleAlert, Search } from "lucide-react";
import * as React from "react";

import type { DataTableEmptyState } from "./props";

export interface ErrorStateProps {
	readonly message: string;
	readonly labels: DataTableLabels;
	/** Adds the retry button. */
	readonly onRetry?: (() => void) | undefined;
}

/** A failed load with no rows to show. */
export const ErrorState = React.memo(function ErrorState({ message, labels, onRetry }: ErrorStateProps): React.JSX.Element {
	return (
		<div role="alert" className="my-8 flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-8 text-center">
			<CircleAlert className="size-6 text-destructive" aria-hidden="true" />
			<p className="text-sm font-medium text-destructive">{message}</p>
			{onRetry === undefined ? null : (
				<Button variant="outline" size="sm" onClick={onRetry}>
					{labels.retry}
				</Button>
			)}
		</div>
	);
});

export interface EmptyStateProps {
	readonly emptyState: DataTableEmptyState | undefined;
	readonly labels: DataTableLabels;
}

/** The table has no rows at all. */
export const EmptyState = React.memo(function EmptyState({ emptyState, labels }: EmptyStateProps): React.JSX.Element {
	return (
		<Empty className="my-12">
			<EmptyHeader>
				<EmptyMedia variant="icon">{emptyState?.icon ?? <Search className="size-6" aria-hidden="true" />}</EmptyMedia>
				<EmptyTitle>{emptyState?.title ?? labels.noDataTitle}</EmptyTitle>
				<EmptyDescription>{emptyState?.description ?? labels.noDataDescription}</EmptyDescription>
			</EmptyHeader>
			{emptyState?.action === undefined ? null : (
				<EmptyContent>
					<Button onClick={emptyState.action.onClick}>{emptyState.action.label}</Button>
				</EmptyContent>
			)}
		</Empty>
	);
});

export interface NoResultsProps {
	readonly labels: DataTableLabels;
	readonly onClearFilters: () => void;
}

/** The search or the filters hide every row. */
export const NoResults = React.memo(function NoResults({ labels, onClearFilters }: NoResultsProps): React.JSX.Element {
	return (
		<Empty className="my-8">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Search className="size-6" aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>{labels.noResultsTitle}</EmptyTitle>
				<EmptyDescription>{labels.noResultsDescription}</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button variant="outline" onClick={onClearFilters}>
					{labels.clearFilters}
				</Button>
			</EmptyContent>
		</Empty>
	);
});
