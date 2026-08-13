"use client";

// ============================================
// app/(panel)/telescope/requests/[id]/page.tsx
// Request detail — the drill-down from the requests table. Renders the span
// timeline (the differentiator), the correlation's SQL + dumps, the captured
// headers, and the sanitized request/response bodies in `pre` blocks.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Braces, Copy, Database, Fingerprint, ListChecks, Loader2, TerminalSquare, TriangleAlert, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import type { TelescopeRequestDetailResponse } from "@workspace/shared";

import { CodeBlock } from "@/components/docs/code-block";
import { SqlList } from "@/components/telescope/sql-list";
import { Timeline } from "@/components/telescope/timeline";
import { durationLabel, formatTime, statusTone } from "@/lib/telescope";

/** Key/value panel (headers) — one table, no per-row hooks. */
function KeyValueTable({
	entries,
	emptyLabel,
}: {
	readonly entries: readonly { readonly key: string; readonly value: string }[];
	readonly emptyLabel: string;
}): React.JSX.Element {
	if (entries.length === 0) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
	}
	return (
		<div className="overflow-hidden rounded-lg border">
			{entries.map((entry) => (
				<div key={entry.key} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-2 border-b px-3 py-1.5 text-xs last:border-b-0">
					<span className="truncate font-mono font-medium text-muted-foreground">{entry.key}</span>
					<span className="font-mono break-all text-foreground">{entry.value}</span>
				</div>
			))}
		</div>
	);
}

/** Pretty-printed JSON body via the shared shiki CodeBlock, or an empty state. */
function BodyBlock({ value, emptyLabel }: { readonly value: string | null; readonly emptyLabel: string }): React.JSX.Element {
	if (value === null) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{emptyLabel}</p>;
	}
	return <CodeBlock code={value} language="json" fileName="body.json" />;
}

export default function TelescopeRequestDetailPage(): React.JSX.Element {
	const { api } = useAuth();
	const params = useParams<{ readonly id: string }>();
	const id: string = params.id;

	const detailQuery = api.procedure(telescopeEndpoints.requestDetail(id)).useQuery();
	const detail: TelescopeRequestDetailResponse | undefined = detailQuery.data?.data;

	// Improvement 13 — export the whole detail payload as JSON for repros/issues.
	// Declared BEFORE the early returns (rules of hooks).
	const handleCopyJson = useCallback((): void => {
		if (detail === undefined) {
			return;
		}
		void navigator.clipboard.writeText(JSON.stringify(detail, null, 2)).then((): void => {
			toast.success("Request copied as JSON.");
		});
	}, [detail]);

	// Improvement v2 — copy a ready-to-run curl command for this request.
	const handleCopyCurl = useCallback((): void => {
		if (detail === undefined) {
			return;
		}
		const { request } = detail;
		const url: string = request.queryString !== null ? `${request.path}?${request.queryString}` : request.path;
		const parts: string[] = [`curl -X ${request.method} '${url}'`];
		if (request.requestHeaders !== null) {
			for (const [key, value] of Object.entries(request.requestHeaders)) {
				parts.push(`  -H '${key}: ${value}'`);
			}
		}
		if (request.requestBody !== null) {
			parts.push(`  -d '${JSON.stringify(request.requestBody)}'`);
		}
		void navigator.clipboard.writeText(parts.join(" \\\n")).then((): void => {
			toast.success("cURL command copied.");
		});
	}, [detail]);

	const headers = useMemo(
		(): readonly { readonly key: string; readonly value: string }[] =>
			detail !== undefined && detail.request.requestHeaders !== null ? Object.entries(detail.request.requestHeaders).map(([key, value]) => ({ key, value })) : [],
		[detail],
	);

	if (detailQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading request…</p>
				</div>
			</div>
		);
	}

	if (detail === undefined) {
		return (
			<div className="mx-auto w-full max-w-7xl">
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
					Request not found — it may have been evicted from the in-memory buffer (an API restart clears Telescope).{" "}
					<Link href="/telescope/requests" className="font-medium underline">
						Back to requests
					</Link>
				</div>
			</div>
		);
	}

	const { request, queries, dumps, n1Warnings } = detail;
	const tone = statusTone(request.statusCode);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<Link href="/telescope/requests" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5" />
				Back to requests
			</Link>

			{/* ── Header card ─────────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-foreground">{request.method}</span>
						<code className="font-mono text-sm text-foreground">{request.path}</code>
						<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums ${tone.pillClass}`}>
							<span className={`size-1.5 rounded-full ${tone.dotClass}`} />
							{tone.label}
						</span>
						<span className="ml-auto font-mono text-sm font-medium text-foreground tabular-nums">{durationLabel(request.durationMs)}</span>
						<Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopyCurl} title="Copy a ready-to-run curl command">
							<TerminalSquare className="size-3" />
							Copy cURL
						</Button>
						<Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleCopyJson}>
							<Copy className="size-3" />
							Copy JSON
						</Button>
					</div>
					<CardDescription className="pt-1">{formatTime(request.createdAt)}</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Fingerprint className="size-3.5 shrink-0" />
						<span className="truncate font-mono">{request.correlationId}</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<UserRound className="size-3.5 shrink-0" />
						<span className="truncate font-mono">{request.userId ?? "anonymous"}</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<span className="shrink-0">IP</span>
						<span className="truncate font-mono">{request.ip ?? "—"}</span>
					</div>
					<div className="flex items-center gap-2 text-muted-foreground">
						<span className="shrink-0">UA</span>
						<span className="truncate">{request.userAgent ?? "—"}</span>
					</div>
				</CardContent>
			</Card>

			{/* ── N+1 warnings (improvement 7) ─────────────────────────── */}
			{n1Warnings.length > 0 ? (
				<Card className="border-amber-300/60 bg-amber-500/5 dark:border-amber-500/40">
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
							N+1 queries detected
						</CardTitle>
						<CardDescription>The same model+operation ran 5+ times — likely a loop fetching related rows one by one.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{n1Warnings.map((warning) => (
							<div key={`${warning.operation}:${warning.model}`} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
								<span className="rounded-md bg-muted px-1.5 py-0.5 font-mono font-medium">{warning.operation}</span>
								<span className="font-mono text-muted-foreground">{warning.model || "(unknown table)"}</span>
								<span className="ml-auto font-medium text-amber-700 tabular-nums dark:text-amber-400">
									{String(warning.count)}× · {durationLabel(warning.totalMs)}
								</span>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{/* ── Timeline ─────────────────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Timeline</CardTitle>
					<CardDescription>Span breakdown — the bars are proportional to time spent, colored by stage.</CardDescription>
				</CardHeader>
				<CardContent>
					<Timeline spans={request.spans} totalMs={request.durationMs} />
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* ── SQL ────────────────────────────────────────────────── */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Database className="size-4 text-muted-foreground" />
							SQL
						</CardTitle>
						<CardDescription>
							{queries.length} quer{queries.length === 1 ? "y" : "ies"} for this correlation.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<SqlList queries={queries} />
					</CardContent>
				</Card>

				{/* ── Dumps ───────────────────────────────────────────────── */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<Braces className="size-4 text-muted-foreground" />
							Dumps
						</CardTitle>
						<CardDescription>
							Values recorded via the Telescope <code className="font-mono">dump</code> probe.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{dumps.length === 0 ? (
							<p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No dumps for this request.</p>
						) : (
							dumps.map((dump) => (
								<div key={dump.id}>
									<CodeBlock code={JSON.stringify(dump.value, null, 2)} language="json" fileName={dump.name} />
								</div>
							))
						)}
					</CardContent>
				</Card>
			</div>

			{/* ── Console output (improvement 16) ──────────────────────── */}
			{request.logs.length > 0 ? (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-base">
							<ListChecks className="size-4 text-muted-foreground" />
							Console output
						</CardTitle>
						<CardDescription>console.* calls that ran inside this request&apos;s async context ({request.logs.length} lines).</CardDescription>
					</CardHeader>
					<CardContent className="space-y-1 overflow-hidden rounded-lg border bg-muted/30 p-2 font-mono text-xs">
						{/* eslint-disable react/no-array-index-key -- Console lines are chronological
						    and static per request (no stable id); the index is the legitimate key. */}
						{request.logs.map((log, index) => (
							<div key={index} className="flex items-baseline gap-2 px-2 py-0.5">
								<span className="shrink-0 text-muted-foreground">{log.timestamp.slice(11, 19)}</span>
								<span
									className={`w-10 shrink-0 font-semibold uppercase ${
										log.level === "error"
											? "text-red-500"
											: log.level === "warn"
												? "text-amber-500"
												: log.level === "debug"
													? "text-muted-foreground"
													: "text-sky-600 dark:text-sky-400"
									}`}>
									{log.level}
								</span>
								<span className="break-all text-foreground">{log.message}</span>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{/* ── Headers + bodies ──────────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Headers & bodies</CardTitle>
					<CardDescription>Whitelisted headers only; bodies are sanitized and truncated at capture (docs/telescope.md §10).</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-6 lg:grid-cols-2">
					<div className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground uppercase">Request headers</p>
						<KeyValueTable entries={headers} emptyLabel="No headers captured (whitelist empty)." />
					</div>
					<div className="space-y-4">
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Request body</p>
							<BodyBlock
								value={request.requestBody !== null ? JSON.stringify(request.requestBody, null, 2) : null}
								emptyLabel="Body capture disabled (TELESCOPE_BODY_CAPTURE)."
							/>
						</div>
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Response body</p>
							<BodyBlock
								value={request.responseBody !== null ? JSON.stringify(request.responseBody, null, 2) : null}
								emptyLabel="Response not captured (JSON-only, sanitized)."
							/>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
