"use client";

import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { DataChangeLogSummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import Link from "next/link";
import * as React from "react";

import { DATA_CHANGE_OPERATION_LABELS } from "@/lib/data-table/enum-filter-options";
import { REQUEST_DATA_CHANGES_FIRST_PAGE, REQUEST_DATA_CHANGES_LIMIT, requestDataChangesQuery } from "@/contexts/audit/lib/request-data-changes-query";
import { ROUTES } from "@/lib/routes";

import { DataChangeOperationBadge } from "./data-change-badges";

/** Placeholder rows while the request's changes load. */
const LOADING_ROWS = 3;

/** `Update users 42 — changed fullName, phone`: the link's spoken name (its visible parts are separate chips). */
function describeChange(change: DataChangeLogSummary): string {
	const target = `${DATA_CHANGE_OPERATION_LABELS[change.operation]} ${change.tableName} ${change.rowId ?? "whole table"}`;
	return change.changedColumns.length === 0 ? target : `${target} — changed ${change.changedColumns.join(", ")}`;
}

/** One changed row: what happened to which row, linking to its full before / after. */
function ChangedRow({ change }: { readonly change: DataChangeLogSummary }): React.JSX.Element {
	return (
		<li className="border-t first:border-t-0">
			<Link
				href={ROUTES.auditLogs.change(change.id)}
				aria-label={describeChange(change)}
				className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/50">
				<DataChangeOperationBadge operation={change.operation} />
				<span className="font-mono text-xs font-medium">{change.tableName}</span>
				<span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{change.rowId ?? "whole table"}</span>
				{change.changedColumns.length === 0 ? null : (
					<span className="w-full truncate text-xs text-muted-foreground sm:w-auto" title={change.changedColumns.join(", ")}>
						{change.changedColumns.join(", ")}
					</span>
				)}
			</Link>
		</li>
	);
}

/**
 * "Database changes" of one HTTP request or background job: every row it
 * inserted, updated or deleted, in the order it wrote them, joined by
 * correlation id (`GET /admin/data-changes?filter[correlationId][eq]=…`, LIST
 * AUDIT_LOG — the same permission as the audit log itself; the API records the
 * read), a page at a time. Each row links to its full redacted before / after.
 */
export function RequestDataChanges({ correlationId }: { readonly correlationId: string }): React.JSX.Element {
	const { api } = useAuth();
	const [page, setPage] = React.useState<number>(REQUEST_DATA_CHANGES_FIRST_PAGE);
	const changesQuery = api.dataChanges.list.useQuery(requestDataChangesQuery(correlationId, page), { placeholderData: keepPreviousData });
	const changes: readonly DataChangeLogSummary[] = changesQuery.data?.data ?? [];
	const total: number = readPaginatedTotal(changesQuery.data?.meta, changes.length);
	const firstShown: number = (page - REQUEST_DATA_CHANGES_FIRST_PAGE) * REQUEST_DATA_CHANGES_LIMIT + 1;
	const lastShown: number = firstShown + changes.length - 1;
	const handlePrevious = React.useCallback((): void => {
		setPage((current: number): number => Math.max(REQUEST_DATA_CHANGES_FIRST_PAGE, current - 1));
	}, []);
	const handleNext = React.useCallback((): void => {
		setPage((current: number): number => current + 1);
	}, []);

	return (
		<section className="space-y-3 rounded-lg border bg-card p-4" aria-busy={changesQuery.isLoading}>
			<div>
				<h3 className="text-sm font-semibold">Database changes</h3>
				<p className="text-xs text-muted-foreground">Every row this request or job wrote, captured by the database itself in the same transaction.</p>
			</div>
			{changesQuery.isLoading ? (
				<div className="space-y-2">
					{placeholderKeys("request-data-change", LOADING_ROWS).map((key) => (
						<Skeleton key={key} variant="text" className="h-5 w-full" />
					))}
				</div>
			) : changesQuery.isError ? (
				<p className="text-sm text-destructive">Could not load the database changes.</p>
			) : changes.length === 0 ? (
				<p className="text-sm text-muted-foreground">No rows were changed.</p>
			) : (
				<>
					<ol className="rounded-md border">
						{changes.map((change: DataChangeLogSummary) => (
							<ChangedRow key={change.id} change={change} />
						))}
					</ol>
					{total > REQUEST_DATA_CHANGES_LIMIT ? (
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>
								{firstShown}–{lastShown} of {total}
							</span>
							<div className="flex gap-2">
								<Button variant="outline" size="sm" onClick={handlePrevious} disabled={page === REQUEST_DATA_CHANGES_FIRST_PAGE}>
									Previous
								</Button>
								<Button variant="outline" size="sm" onClick={handleNext} disabled={lastShown >= total}>
									Next
								</Button>
							</div>
						</div>
					) : null}
				</>
			)}
		</section>
	);
}
