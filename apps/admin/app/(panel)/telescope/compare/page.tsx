"use client";

// ============================================
// app/(panel)/telescope/compare/page.tsx
// Improvement 6 — side-by-side request diff. Reach it by selecting exactly
// two rows on the Requests table (bulk action "Compare") or via
// `/telescope/compare?a=<id>&b=<id>`. Shows the scalar diff table plus quick
// links into each request's full detail.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, GitCompareArrows, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import type { TelescopeCompareResponse, TelescopeDiffField } from "@workspace/shared";

import { Timeline } from "@/components/telescope/timeline";
import { durationLabel, formatTime, statusTone } from "@/lib/telescope";

function CompareContent(): React.JSX.Element {
	const { api } = useAuth();
	const searchParams = useSearchParams();
	const idA: string | null = searchParams.get("a");
	const idB: string | null = searchParams.get("b");

	const valid: boolean = idA !== null && idB !== null && idA.length > 0 && idB.length > 0;

	const compareQuery = api.procedure(telescopeEndpoints.compare(idA ?? "", idB ?? "")).useQuery(undefined, {
		enabled: valid,
	});

	const response: TelescopeCompareResponse | undefined = compareQuery.data?.data;

	const diffRows = useMemo(
		(): readonly { readonly field: string; readonly a: string | null; readonly b: string | null; readonly same: boolean }[] =>
			response !== undefined ? response.diffs.map((diff: TelescopeDiffField) => ({ field: diff.field, a: diff.valueA, b: diff.valueB, same: diff.same })) : [],
		[response],
	);

	if (!valid) {
		return (
			<div className="mx-auto w-full max-w-3xl space-y-6">
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Compare requests</h1>
				<div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					Select exactly two rows on the{" "}
					<Link href="/telescope/requests" className="font-medium text-primary hover:underline">
						Requests
					</Link>{" "}
					table and choose <span className="font-medium text-foreground">Compare</span> from the bulk actions, or open the page with{" "}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">?a=&lt;id&gt;&amp;b=&lt;id&gt;</code>.
				</div>
			</div>
		);
	}

	if (compareQuery.isLoading && response === undefined) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Comparing requests…</p>
				</div>
			</div>
		);
	}

	if (response === undefined) {
		return (
			<div className="mx-auto w-full max-w-3xl">
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
					Could not load the comparison — one of the requests may have been evicted from the buffer.
					<Link href="/telescope/requests" className="ml-2 font-medium underline">
						Back to requests
					</Link>
				</div>
			</div>
		);
	}

	const toneA = statusTone(response.a.statusCode);
	const toneB = statusTone(response.b.statusCode);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<Link href="/telescope/requests" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
				<ArrowLeft className="size-3.5" />
				Back to requests
			</Link>

			<header>
				<h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
					<GitCompareArrows className="size-6 text-muted-foreground" />
					Request comparison
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">Same-field differences between the two captured requests.</p>
			</header>

			{/* ── The two requests at a glance ─────────────────────────── */}
			<div className="grid gap-4 sm:grid-cols-2">
				{([response.a, response.b] as const).map((request, index) => {
					const tone = index === 0 ? toneA : toneB;
					return (
						<Card key={request.id}>
							<CardHeader className="pb-2">
								<div className="flex items-center gap-2">
									<span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">{request.method}</span>
									<code className="truncate font-mono text-xs">{request.path}</code>
								</div>
								<CardDescription className="pt-1">
									{index === 0 ? "Request A" : "Request B"} · {formatTime(request.createdAt)}
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap items-center gap-2 text-xs">
								<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono tabular-nums ${tone.pillClass}`}>
									<span className={`size-1.5 rounded-full ${tone.dotClass}`} />
									{tone.label}
								</span>
								<span className="font-mono text-muted-foreground tabular-nums">{durationLabel(request.durationMs)}</span>
								<Link href={`/telescope/requests/${request.id}`} className="ml-auto font-medium text-primary hover:underline">
									Open detail →
								</Link>
							</CardContent>
						</Card>
					);
				})}
			</div>

			{/* ── Diff table ───────────────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Differences</CardTitle>
					<CardDescription>Identical rows are faded — only the meaningful deltas stand out.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-hidden rounded-lg border">
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b bg-muted/30 text-left">
								<th className="px-3 py-2 font-semibold text-muted-foreground uppercase">Field</th>
								<th className="px-3 py-2 font-semibold text-muted-foreground uppercase">Request A</th>
								<th className="px-3 py-2 font-semibold text-muted-foreground uppercase">Request B</th>
							</tr>
						</thead>
						<tbody>
							{diffRows.map((row) => (
								<tr key={row.field} className={`border-b last:border-b-0 ${row.same ? "opacity-45" : ""}`}>
									<td className="px-3 py-2 font-medium text-muted-foreground">{row.field}</td>
									<td className={`px-3 py-2 font-mono ${row.same ? "text-muted-foreground" : "text-foreground"}`}>{row.a ?? "—"}</td>
									<td className={`px-3 py-2 font-mono ${row.same ? "text-muted-foreground" : "text-foreground"}`}>{row.b ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</CardContent>
			</Card>

			{/* ── Timelines side by side (feature 14) ──────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Timelines</CardTitle>
					<CardDescription>Both requests’ span waterfalls — scan for structural differences at a glance.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 lg:grid-cols-2">
					<div>
						<p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Request A</p>
						<Timeline
							spans={response.a.spans}
							totalMs={Math.max(1, response.a.durationMs)}
							queries={response.queriesA.map((query) => ({ query, startOffsetMs: query.startOffsetMs }))}
						/>
					</div>
					<div>
						<p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Request B</p>
						<Timeline
							spans={response.b.spans}
							totalMs={Math.max(1, response.b.durationMs)}
							queries={response.queriesB.map((query) => ({ query, startOffsetMs: query.startOffsetMs }))}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

/** `useSearchParams` must render under a Suspense boundary during prerender. */
export default function TelescopeComparePage(): React.JSX.Element {
	return (
		<Suspense fallback={null}>
			<CompareContent />
		</Suspense>
	);
}
