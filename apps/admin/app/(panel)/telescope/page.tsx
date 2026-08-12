"use client";

// ============================================
// app/(panel)/telescope/page.tsx
// Telescope Overview — the live dashboard (docs/telescope.md §8).
//
// Smart page: owns the range state and the data queries (overview + a 5-row
// exceptions preview), renders dumb StatCards / ExceptionCards / RangePicker.
// Polls every 5s so the numbers tick while you debug; `placeholderData` keeps
// the previous snapshot during each poll so the layout never blanks.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Loader2, Activity, Clock, Database, Mail, ShieldAlert, TriangleAlert } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import type { TelescopeOverview, TelescopeRange } from "@workspace/shared";

import { RangePicker } from "@/components/telescope/range-picker";
import { StatCard } from "@/components/telescope/stat-card";
import { ExceptionCard } from "@/components/telescope/exception-card";
import { durationLabel, rangeLabel } from "@/lib/telescope";

/** How often the overview refreshes (ms) — a dev tool should feel live. */
const POLL_MS: number = 5000;

export default function TelescopeOverviewPage(): React.JSX.Element {
	const { api } = useAuth();
	const [range, setRange] = useState<TelescopeRange>("15m");

	const overviewQuery = api.procedure(telescopeEndpoints.overview(range)).useQuery(
		{ query: { range } },
		{
			refetchInterval: POLL_MS,
			placeholderData: (previous: TelescopeOverview | undefined): TelescopeOverview | undefined => previous,
		},
	);

	const exceptionsQuery = api.procedure(
		telescopeEndpoints.exceptions({ page: 1, pageSize: 5 }),
	).useQuery(
		{ query: { page: 1, pageSize: 5 } },
		{ refetchInterval: POLL_MS, placeholderData: (previous) => previous },
	);

	const handleRangeChange = useCallback((next: TelescopeRange): void => {
		setRange(next);
	}, []);

	const overview: TelescopeOverview | undefined = overviewQuery.data?.overview;
	const recentExceptions = useMemo(() => exceptionsQuery.data?.list.items ?? [], [exceptionsQuery.data]);

	if (overviewQuery.isLoading && overview === undefined) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading telescope…</p>
				</div>
			</div>
		);
	}

	if (overviewQuery.error && overview === undefined) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load the telescope overview — check that the API is running and you&apos;re signed in.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Telescope</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Live observability for the {rangeLabel(range)} — requests, SQL, exceptions and mail, captured in memory and refreshing automatically.
					</p>
				</div>
				<RangePicker value={range} onChange={handleRangeChange} />
			</header>

			{overview === undefined ? null : (
				<>
					{/* ── Traffic + latency ─────────────────────────────── */}
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard label="Requests" value={overview.requests} sub={rangeLabel(range)} icon={<Activity className="size-4" />} accentClass="text-sky-500" />
						<StatCard label="Avg duration" value={durationLabel(overview.avgDurationMs)} sub="across all requests" icon={<Clock className="size-4" />} accentClass="text-emerald-500" />
						<StatCard label="P95 duration" value={durationLabel(overview.p95DurationMs)} sub="slowest 5% baseline" icon={<Clock className="size-4" />} accentClass="text-amber-500" />
						<StatCard label="Errors" value={overview.errorCount} sub="5xx responses" icon={<TriangleAlert className="size-4" />} accentClass="text-red-500" />
					</div>

					{/* ── Data + mail ───────────────────────────────────── */}
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard label="SQL queries" value={overview.sqlCount} sub={rangeLabel(range)} icon={<Database className="size-4" />} accentClass="text-violet-500" />
						<StatCard label="Slow SQL" value={overview.slowSqlCount} sub="≥500ms" icon={<Database className="size-4" />} accentClass="text-amber-500" />
						<StatCard label="Exception groups" value={overview.exceptionGroups} sub="deduped by stack" icon={<ShieldAlert className="size-4" />} accentClass="text-red-500" />
						<StatCard
							label="Mail"
							value={overview.mailSent}
							sub={`${String(overview.mailDelivered)} delivered`}
							icon={<Mail className="size-4" />}
							accentClass="text-emerald-500"
							href="/telescope/mail"
						/>
					</div>

					{/* ── Slowest request drill-down ───────────────────── */}
					{overview.slowest !== null ? (
						<StatCard
							label="Slowest request"
							value={`${overview.slowest.method} ${overview.slowest.path}`}
							sub={`${durationLabel(overview.slowest.durationMs)} · status ${String(overview.slowest.statusCode ?? "—")} · ${rangeLabel(range)}`}
							icon={<Clock className="size-4" />}
							accentClass="text-red-500"
							href={`/telescope/requests/${overview.slowest.id}`}
						/>
					) : null}

					{/* ── Recent exceptions ────────────────────────────── */}
					{recentExceptions.length > 0 ? (
						<section className="space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-foreground">Recent exceptions</h2>
								<a href="/telescope/exceptions" className="text-xs font-medium text-primary hover:underline">
									View all →
								</a>
							</div>
							{recentExceptions.map((exception) => (
								<ExceptionCard key={exception.id} exception={exception} />
							))}
						</section>
					) : null}
				</>
			)}
		</div>
	);
}
