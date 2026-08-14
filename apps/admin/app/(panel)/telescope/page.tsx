"use client";

// ============================================
// app/(panel)/telescope/page.tsx
// Telescope Overview — the live dashboard (docs/telescope.md §8).
//
// Smart page: owns the range state (synced to `?range=`), the data queries
// (overview + a 5-row exceptions preview) and the SSE live subscription.
// Improvement v2 polish: skeleton loaders, a connection chip (event count /
// last-event age / reconnect count), pause-resume, a traffic sparkline and a
// live activity feed rendered straight from the SSE buffer — no refetch
// needed to see new requests stream in.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Button } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { Activity, Clock, Database, Fingerprint, Mail, Pause, Play, Radio, ShieldAlert, Star, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";

import { TelescopeRangeSchema, type TelescopeOverview, type TelescopeRange, type TelescopeStreamEvent } from "@workspace/shared";

import { AlertsPanel } from "@/components/telescope/alerts-panel";
import { AnimatedNumber } from "@/components/telescope/animated-number";
import { ErrorRateChart } from "@/components/telescope/error-rate-chart";
import { ExceptionCard } from "@/components/telescope/exception-card";
import { LeaderboardPanel } from "@/components/telescope/leaderboard-panel";
import { LiveFeedCard } from "@/components/telescope/live-feed-card";
import { RangePicker } from "@/components/telescope/range-picker";
import { StatCard } from "@/components/telescope/stat-card";
import { TrafficSparkline } from "@/components/telescope/traffic-sparkline";
import { WebhookDeliveries } from "@/components/telescope/webhook-deliveries";
import { durationLabel, durationTone, rangeLabel, statusTone, streamEventTarget, timeAgo } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

/** Skeleton block shown while the first overview payload loads. */
function OverviewSkeleton(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-4 w-96 max-w-full" />
				</div>
				<Skeleton className="h-8 w-52" />
			</header>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: 4 }, (_, index) => (
					<Skeleton key={index} className="h-24 rounded-lg" />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-3">
				<Skeleton className="h-40 rounded-lg lg:col-span-2" />
				<Skeleton className="h-40 rounded-lg" />
			</div>
		</div>
	);
}

function OverviewContent(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();

	const parsedRange = TelescopeRangeSchema.safeParse(searchParams.get("range"));
	const rangeParam: TelescopeRange | null = parsedRange.success ? parsedRange.data : null;
	const [range, setRange] = useState<TelescopeRange>(rangeParam ?? "15m");

	// Range lives in the URL so a refresh keeps the same window (v2 polish).
	const handleRangeChange = useCallback(
		(next: TelescopeRange): void => {
			setRange(next);
			router.replace(`/telescope?range=${next}`, { scroll: false });
		},
		[router],
	);

	const overviewQuery = api.procedure(telescopeEndpoints.overview(range)).useQuery({ query: { range } }, { placeholderData: (previous) => previous });

	const exceptionsQuery = api
		.procedure(telescopeEndpoints.exceptions({ page: 1, pageSize: 5 }))
		.useQuery({ query: { page: 1, pageSize: 5 } }, { placeholderData: (previous) => previous });

	// Feature 13 — long-window error-rate trend (6h/24h lens the overview
	// sparkline cannot show). Kept on the same range state so the header's
	// RangePicker drives it too.
	const trendsQuery = api.procedure(telescopeEndpoints.trends({ range })).useQuery({ query: { range } }, { placeholderData: (previous) => previous });

	// Feature 12 — slow-endpoint leaderboard for the current window.
	const leaderboardQuery = api.procedure(telescopeEndpoints.leaderboard({ range })).useQuery({ query: { range } }, { placeholderData: (previous) => previous });

	// Feature 18 — recently fired threshold alerts.
	const alertsQuery = api.procedure(telescopeEndpoints.alerts()).useQuery(undefined, { placeholderData: (previous) => previous });

	// Feature 4 — the starred requests quick-access panel.
	const starredQuery = api
		.procedure(telescopeEndpoints.requests({ page: 1, pageSize: 5, sort: "newest", starred: "true" }))
		.useQuery({ query: { page: 1, pageSize: 5, sort: "newest", starred: "true" } }, { placeholderData: (previous) => previous });

	// Feature 13 — recent alert-webhook deliveries.
	const deliveriesQuery = api.procedure(telescopeEndpoints.webhookDeliveries()).useQuery(undefined, { placeholderData: (previous) => previous });

	// Improvement 5 — after an ack/snooze (handled inside AlertsPanel's per-row
	// actions, which own their mutations), refetch to reflect the new status.
	const handleAlertsChanged = useCallback((): void => {
		void alertsQuery.refetch();
	}, [alertsQuery]);

	// Improvement 2: refetch on SSE pushes instead of polling on a timer. The
	// alerts query is included so a FAILED job (job alert) surfaces in the
	// Alerts panel the moment it lands — no manual refresh.
	const refresh = useCallback((): void => {
		void overviewQuery.refetch();
		void exceptionsQuery.refetch();
		void alertsQuery.refetch();
	}, [overviewQuery, exceptionsQuery, alertsQuery]);
	const live = useTelescopeLive(refresh);

	// Track the previous error count so a NEW error pulses the card (v2).
	const [errorFlash, setErrorFlash] = useState<number>(0);
	const prevErrorCount = useRef<number>(0);
	useEffect((): void => {
		const errorCount: number = overviewQuery.data?.data.overview.errorCount ?? 0;
		if (errorCount > prevErrorCount.current) {
			setErrorFlash((key: number): number => key + 1);
		}
		prevErrorCount.current = errorCount;
	}, [overviewQuery.data]);

	// Keyboard shortcuts: r = refresh, p = pause/resume (v2).
	const togglePause = useCallback((): void => {
		if (live.paused) {
			live.resume();
		} else {
			live.pause();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `live` is the whole result object; the paused flag + stable callbacks are the real deps.
	}, [live.paused, live.pause, live.resume]);

	useEffect((): (() => void) => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
				return;
			}
			if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) {
				return;
			}
			if (event.key.toLowerCase() === "r") {
				refresh();
			} else if (event.key.toLowerCase() === "p") {
				togglePause();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return (): void => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [refresh, togglePause]);

	const overview: TelescopeOverview | undefined = overviewQuery.data?.data.overview;
	const recentExceptions = useMemo(() => exceptionsQuery.data?.data.list.items ?? [], [exceptionsQuery.data]);
	const trendPoints = useMemo(() => trendsQuery.data?.data.points ?? [], [trendsQuery.data]);
	const leaderboardEntries = useMemo(() => leaderboardQuery.data?.data.entries ?? [], [leaderboardQuery.data]);
	const alertEntries = useMemo(() => alertsQuery.data?.data.items ?? [], [alertsQuery.data]);
	const starredEntries = useMemo(() => starredQuery.data?.data.list.items ?? [], [starredQuery.data]);
	const deliveryEntries = useMemo(() => deliveriesQuery.data?.data.items ?? [], [deliveriesQuery.data]);

	// A ticking "Xs ago" for the last SSE event — re-renders every 5s. The
	// interval effect sets the initial tick immediately (no impure Date.now()
	// in the render path), then every 5s.
	const [nowTick, setNowTick] = useState<number>(0);
	useEffect((): (() => void) => {
		const tick = (): void => {
			setNowTick(Date.now());
		};
		tick();
		const timer: ReturnType<typeof setInterval> = setInterval(tick, 5000);
		return (): void => {
			clearInterval(timer);
		};
	}, []);

	// Clicking a feed row: the shared streamEventTarget helper decides the
	// route (request detail, exceptions list, or a job's correlated request).
	const handleFeedNavigate = useCallback(
		(event: TelescopeStreamEvent): void => {
			const target: string | null = streamEventTarget(event);
			if (target !== null) router.push(target);
		},
		[router],
	);

	if (overviewQuery.isLoading && overview === undefined) {
		return <OverviewSkeleton />;
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
					<div className="flex flex-wrap items-center gap-2.5">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">Telescope</h1>

						{/* Connection chip (v2): live state + event count + last-event age + reconnects. */}
						<span
							className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
								live.connected
									? "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400"
									: "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400"
							}`}>
							<span className={`size-1.5 animate-pulse rounded-full ${live.connected ? "bg-emerald-500" : "bg-amber-500"}`} />
							{live.paused ? "paused" : live.connected ? "live" : "reconnecting…"}
							{live.eventCount > 0 ? (
								<span className="opacity-80">
									· {String(live.eventCount)} event{live.eventCount === 1 ? "" : "s"}
								</span>
							) : null}
							{live.lastEventAt !== null ? <span className="opacity-80">· {timeAgo(live.lastEventAt, nowTick)}</span> : null}
							{live.reconnectCount > 0 ? (
								<span className="opacity-80">
									· {String(live.reconnectCount)} reconnect{live.reconnectCount === 1 ? "" : "s"}
								</span>
							) : null}
						</span>
					</div>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Live observability for the {rangeLabel(range)} — requests, SQL, exceptions and mail, updating in real time via SSE.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={togglePause}>
						{live.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
						{live.paused ? "Resume" : "Pause"}
					</Button>
					<RangePicker value={range} onChange={handleRangeChange} />
				</div>
			</header>

			{overview === undefined ? null : (
				<>
					{/* ── Traffic + latency ─────────────────────────────── */}
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard
							label="Requests"
							value={<AnimatedNumber value={overview.requests} />}
							sub={rangeLabel(range)}
							icon={<Activity className="size-4" />}
							accentClass="text-sky-500"
						/>
						<StatCard
							label="Avg duration"
							value={durationLabel(overview.avgDurationMs)}
							sub="across all requests"
							icon={<Clock className="size-4" />}
							accentClass="text-emerald-500"
						/>
						<StatCard
							label="P95 duration"
							value={durationLabel(overview.p95DurationMs)}
							sub="slowest 5% baseline"
							icon={<Clock className="size-4" />}
							accentClass="text-amber-500"
						/>
						<StatCard
							label="Errors"
							value={<AnimatedNumber value={overview.errorCount} />}
							sub="5xx responses"
							icon={<TriangleAlert className="size-4" />}
							accentClass="text-red-500"
							pulseKey={errorFlash}
						/>
					</div>

					{/* ── Sparkline + live feed (v2) ───────────────────── */}
					<div className="grid gap-6 lg:grid-cols-3">
						<section className="space-y-2 lg:col-span-2">
							<div className="flex items-center justify-between">
								<h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
									<Radio className="size-3.5 text-muted-foreground" />
									Traffic
								</h2>
								<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
									<span className="inline-flex items-center gap-1.5">
										<span className="size-2 rounded-full bg-[var(--chart-2)]" />
										Requests
									</span>
									<span className="inline-flex items-center gap-1.5">
										<span className="size-2 rounded-full bg-[var(--chart-4)]" />
										Errors
									</span>
								</div>
							</div>
							<div className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
								<TrafficSparkline points={overview.traffic} />
							</div>
							{/* Status-class mini bars (v2) */}
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
								{(
									[
										{ key: "2xx", label: "2xx", className: "bg-emerald-500" },
										{ key: "3xx", label: "3xx", className: "bg-sky-500" },
										{ key: "4xx", label: "4xx", className: "bg-amber-500" },
										{ key: "5xx", label: "5xx", className: "bg-red-500" },
										{ key: "other", label: "—", className: "bg-muted-foreground" },
									] as const
								).map((segment) => (
									<div key={segment.key} className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
										<div className="flex items-center justify-between text-xs">
											<span className="font-medium text-muted-foreground">{segment.label}</span>
											<span className="font-semibold tabular-nums">{String(overview.statusCounts[segment.key])}</span>
										</div>
										<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
											<div
												className={`h-full rounded-full ${segment.className} transition-[width] duration-500`}
												style={{ width: `${String(overview.requests > 0 ? Math.max(4, (overview.statusCounts[segment.key] / overview.requests) * 100) : 0)}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</section>

						<LiveFeedCard events={live.events} onNavigate={handleFeedNavigate} paused={live.paused} linkHref="/telescope/requests" linkLabel="View all →" />
					</div>

					{/* ── Data + mail ───────────────────────────────────── */}
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard
							label="SQL queries"
							value={<AnimatedNumber value={overview.sqlCount} />}
							sub={rangeLabel(range)}
							icon={<Database className="size-4" />}
							accentClass="text-violet-500"
							href="/telescope/sql"
						/>
						<StatCard
							label="Slow SQL"
							value={<AnimatedNumber value={overview.slowSqlCount} />}
							sub="≥500ms"
							icon={<Database className="size-4" />}
							accentClass="text-amber-500"
							href="/telescope/sql"
						/>
						<StatCard
							label="Exception groups"
							value={<AnimatedNumber value={overview.exceptionGroups} />}
							sub="deduped by stack"
							icon={<ShieldAlert className="size-4" />}
							accentClass="text-red-500"
							href="/telescope/exceptions"
						/>
						<StatCard
							label="N+1 flagged"
							value={<AnimatedNumber value={overview.n1RequestCount} />}
							sub="requests with query loops"
							icon={<TriangleAlert className="size-4" />}
							accentClass="text-amber-500"
							href="/telescope/requests?sort=duration"
						/>
						<StatCard
							label="Mail"
							value={<AnimatedNumber value={overview.mailSent} />}
							sub={`${String(overview.mailDelivered)} delivered`}
							icon={<Mail className="size-4" />}
							accentClass="text-emerald-500"
							href="/telescope/mail"
						/>
						<StatCard
							label="PII flagged"
							value={<AnimatedNumber value={overview.piiRequestCount} />}
							sub="sensitive data detected at capture"
							icon={<Fingerprint className="size-4" />}
							accentClass="text-violet-500"
						/>
					</div>

					{/* Improvement 19 — capture-pipeline health card. */}
					<div className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:grid-cols-4">
						<div>
							<p className="text-xs text-muted-foreground">Store</p>
							<p className="mt-1 font-mono text-sm font-semibold capitalize">{overview.health.mode}</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Capture</p>
							<p
								className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${overview.health.enabled ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
								<span className={`size-1.5 rounded-full ${overview.health.enabled ? "bg-emerald-500" : "bg-red-500"}`} />
								{overview.health.enabled ? "active" : "off"}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Buffer</p>
							<p className="mt-1 text-sm font-semibold tabular-nums">
								{String(overview.health.bufferRequests)}/{String(overview.health.bufferCap)}
								{overview.health.bufferCap > 0 ? ` (${String(Math.round((overview.health.bufferRequests / overview.health.bufferCap) * 100))}%)` : ""}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Retention</p>
							<p className="mt-1 text-sm font-semibold tabular-nums">{String(overview.health.retentionMinutes)}m</p>
						</div>
					</div>

					{/* ── Starred requests (feature 4) ──────────────────── */}
					{starredEntries.length > 0 ? (
						<section className="space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
									<Star className="size-3.5 text-amber-500" />
									Starred requests
								</h2>
								<Link href="/telescope/requests?starred=true" className="text-xs font-medium text-primary hover:underline">
									All starred →
								</Link>
							</div>
							<div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs">
								{starredEntries.map((entry) => {
									const tone = statusTone(entry.statusCode);
									return (
										<Link
											key={entry.id}
											href={`/telescope/requests/${entry.id}`}
											className="flex items-center gap-3 border-b px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-accent">
											<span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${tone.pillClass}`}>{entry.method}</span>
											<span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.path}</span>
											<span className={`shrink-0 font-mono text-xs tabular-nums ${durationTone(entry.durationMs).textClass}`}>{durationLabel(entry.durationMs)}</span>
										</Link>
									);
								})}
							</div>
						</section>
					) : null}

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
								<Link href="/telescope/exceptions" className="text-xs font-medium text-primary hover:underline">
									View all →
								</Link>
							</div>
							{recentExceptions.map((exception) => (
								<ExceptionCard key={exception.id} exception={exception} />
							))}
						</section>
					) : null}

					{/* ── Error-rate trend (feature 13) ────────────────── */}
					<section className="space-y-2">
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-foreground">Error rate</h2>
							<span className="text-[11px] text-muted-foreground">{rangeLabel(range)} · % of requests returning 5xx</span>
						</div>
						<div className="rounded-lg border bg-card p-3 text-card-foreground shadow-xs">
							<ErrorRateChart points={trendPoints} />
						</div>
					</section>

					{/* ── Leaderboard + alerts (features 12, 18) ────────── */}
					<div className="grid gap-6 lg:grid-cols-2">
						<section className="space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-foreground">Slowest endpoints</h2>
								<Link href="/telescope/requests?sort=duration" className="text-xs font-medium text-primary hover:underline">
									All requests →
								</Link>
							</div>
							<div className="rounded-lg border bg-card p-2 text-card-foreground shadow-xs">
								<LeaderboardPanel entries={leaderboardEntries} />
							</div>
						</section>

						<section className="space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-semibold text-foreground">Alerts</h2>
								<Link href="/telescope/requests" className="text-xs font-medium text-primary hover:underline">
									Requests →
								</Link>
							</div>
							<div className="space-y-2">
								<div className="rounded-lg border bg-card p-2 text-card-foreground shadow-xs">
									<AlertsPanel alerts={alertEntries} onChanged={handleAlertsChanged} />
								</div>
								{/* Feature 13 — webhook delivery log. */}
								<div className="rounded-lg border bg-card p-2 text-card-foreground shadow-xs">
									<h3 className="px-2 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Webhook deliveries</h3>
									<WebhookDeliveries deliveries={deliveryEntries} isLoading={deliveriesQuery.isLoading} />
								</div>
							</div>
						</section>
					</div>
				</>
			)}
		</div>
	);
}

/** `useSearchParams` must render under a Suspense boundary during prerender. */
export default function TelescopeOverviewPage(): React.JSX.Element {
	return (
		<Suspense fallback={null}>
			<OverviewContent />
		</Suspense>
	);
}
