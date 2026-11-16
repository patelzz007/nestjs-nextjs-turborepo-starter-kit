"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { appRoute } from "@workspace/client/lib/navigation/app-route";
import type { DocsSyncHeldBackPage, DocsSyncRunDetail, Envelope } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { DOCS_SYNC_LOADING_LABELS } from "@/components/loading/loading-labels";
import { DOCS_SYNC_TABLE_PAGE, TablePageSkeleton } from "@/components/loading/table-page-skeleton";
import { orDash, RecordField, RecordSection } from "@/contexts/audit";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";

import { DOCS_SOURCE_LABELS, DOCS_SYNC_TRIGGER_LABELS, DocsSyncStatusBadge } from "./docs-sync-badges";

const MS_PER_SECOND = 1000;

function durationLabel(run: DocsSyncRunDetail): string {
	return `${String(Math.round((run.finishedAt - run.startedAt) / MS_PER_SECOND))} s`;
}

/** One held-back page: every problem, in words its writer can act on. */
function HeldBackPage({ page }: { readonly page: DocsSyncHeldBackPage }): React.JSX.Element {
	return (
		<li className="rounded-lg border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="font-medium">{page.title}</p>
					<p className="font-mono text-xs break-all text-muted-foreground">{page.slug ?? "No slug yet"}</p>
				</div>
				{page.sourceUrl === null ? null : (
					<a href={page.sourceUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}>
						<ExternalLink className="size-3.5" aria-hidden />
						Open the page
					</a>
				)}
			</div>
			<ul className="mt-3 space-y-2">
				{page.issues.map((issue) => (
					<li key={`${issue.blockId ?? "page"}:${issue.reason}`} className="text-sm">
						<p>{issue.reason}</p>
						<p className="text-muted-foreground">{issue.fix}</p>
						{issue.blockId === null ? null : (
							<p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">
								{issue.blockType} · {issue.blockId}
							</p>
						)}
					</li>
				))}
			</ul>
		</li>
	);
}

/** One sync run, presentational: the caller fetched it. */
export function DocsSyncRunRecord({ record }: { readonly record: DocsSyncRunDetail }): React.JSX.Element {
	return (
		<div className="space-y-4">
			<header className="flex flex-wrap items-center gap-2">
				<h1 className="text-xl font-semibold text-foreground">{DOCS_SYNC_TRIGGER_LABELS[record.trigger]}</h1>
				<span className="text-sm text-muted-foreground tabular-nums">{formatDateTimeWithSeconds(record.startedAt)}</span>
				<DocsSyncStatusBadge status={record.status} />
			</header>

			{record.errorSummary === null ? null : (
				<section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
					<h2 className="text-sm font-semibold text-destructive">Why nothing was published</h2>
					<p className="mt-1 text-sm break-words text-destructive">{record.errorSummary}</p>
				</section>
			)}

			{record.heldBack.length === 0 ? null : (
				<section className="space-y-3">
					<div>
						<h2 className="text-sm font-semibold">Held-back pages</h2>
						<p className="text-xs text-muted-foreground">Each page keeps its last good version on the site until these are fixed. The next sync tries again.</p>
					</div>
					<ul className="space-y-3">
						{record.heldBack.map((page) => (
							<HeldBackPage key={page.sourceId} page={page} />
						))}
					</ul>
				</section>
			)}

			<RecordSection title="Pages" description="What this run did to the site." layout="page">
				<RecordField label="Written">{record.pagesProcessed}</RecordField>
				<RecordField label="Unchanged">{record.pagesUnchanged}</RecordField>
				<RecordField label="Removed">{record.pagesRemoved}</RecordField>
				<RecordField label="Held back">{record.pagesHeldBack}</RecordField>
				<RecordField label="Warnings">{record.warnings}</RecordField>
			</RecordSection>

			<RecordSection title="Run" description="Where it came from and where it went." layout="page">
				<RecordField label="Source">{DOCS_SOURCE_LABELS[record.source]}</RecordField>
				<RecordField label="Duration">{durationLabel(record)}</RecordField>
				<RecordField label="Converter version">{record.converterVersion}</RecordField>
				<RecordField label="Pull request">
					{record.pullRequestUrl === null ? (
						orDash(null)
					) : (
						<a href={record.pullRequestUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
							Open on GitHub
						</a>
					)}
				</RecordField>
				<RecordField label="Commit" mono>
					{orDash(record.commitSha)}
				</RecordField>
				<RecordField label="Run id" mono>
					{record.runId}
				</RecordField>
			</RecordSection>
		</div>
	);
}

export interface DocsSyncRunDetailViewProps {
	readonly id: string;
	/** The server-prefetched run, or `undefined` when the prefetch failed. */
	readonly initialRecord?: Envelope<DocsSyncRunDetail> | undefined;
}

/** `/operations/docs-sync/[id]`: one sync run on its own read-only page. */
export default function DocsSyncRunDetailView({ id, initialRecord }: DocsSyncRunDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	const query = api.docsPublishing.run.useQuery({ id }, initialDataOption(initialRecord));
	const record = query.data?.data;

	return (
		<div className="mx-auto w-full max-w-5xl space-y-4">
			<Link href={appRoute(ROUTES.operations.docsSync)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
				Back to Docs sync
			</Link>
			{record === undefined ? (
				query.error === null ? (
					<TablePageSkeleton labels={DOCS_SYNC_LOADING_LABELS} shape={DOCS_SYNC_TABLE_PAGE} />
				) : (
					<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">Failed to load this sync run.</div>
				)
			) : (
				<DocsSyncRunRecord record={record} />
			)}
		</div>
	);
}
