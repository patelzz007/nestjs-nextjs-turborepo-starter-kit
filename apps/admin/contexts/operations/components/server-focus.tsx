"use client";

// One server on the Servers page: who it is, its CPU over a chosen range as a full-width chart, and
// CPU, memory and storage as figures with their own sparklines. One cached history query (TanStack
// Query) feeds all of it, the same one the server's own page reads.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { machineSpecLine, OpsHistoryRangeSchema, percentOf, storageTotals, type OpsHistoryRange, type OpsServerPoint, type OpsServerSummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { formatAgo, formatBytes, formatPercent, HEALTH_PRESENTATION } from "../lib/ops-format";
import { opsHistoryQuery } from "../lib/ops-queries";
import { AreaTrendChart, type AreaTrendSeries } from "./area-trend-chart";
import { PROVIDER_LABELS, ProviderIcon } from "./provider-icon";
import { SparkStatCard, type SparkStatChange } from "./spark-stat-card";

/** The ranges this page offers (the server's own page offers them all). */
export const FOCUS_RANGES: readonly OpsHistoryRange[] = ["1h", "24h", "7d", "30d"];
const RANGE_WORDS: Readonly<Record<OpsHistoryRange, string>> = { "1h": "1 hour", "6h": "6 hours", "24h": "24 hours", "7d": "7 days", "30d": "30 days", "1y": "1 year" };
const PERCENT_DOMAIN: [number, number] = [0, 100];
const CPU_SERIES: readonly AreaTrendSeries<"cpu">[] = [{ key: "cpu", label: "CPU", color: "var(--chart-1)" }];

/** A share's move over the range, in percentage points, worded. */
export function shareChange(first: number | undefined, last: number | undefined, range: OpsHistoryRange): SparkStatChange | null {
	if (first === undefined || last === undefined) {
		return null;
	}
	const delta = Math.round(last - first);
	const label = delta === 0 ? `Same as ${RANGE_WORDS[range]} ago` : `${String(Math.abs(delta))} pts ${delta > 0 ? "higher" : "lower"} than ${RANGE_WORDS[range]} ago`;
	return { delta, label, higherIsWorse: true };
}

/** The share series of a server's history points. */
export function usageSeries(points: readonly OpsServerPoint[]): {
	readonly cpu: { at: number; value: number }[];
	readonly memory: { at: number; value: number }[];
	readonly disk: { at: number; value: number }[];
} {
	return {
		cpu: points.map((point) => ({ at: point.bucketStart, value: point.cpuPercentAvg })),
		memory: points.map((point) => ({ at: point.bucketStart, value: percentOf(point.memoryUsedBytes, point.memoryTotalBytes) })),
		disk: points.map((point) => ({ at: point.bucketStart, value: point.diskPercentMax })),
	};
}

export function ServerFocus({ server, now }: { readonly server: OpsServerSummary; readonly now: number }): React.JSX.Element {
	const { api } = useAuth();
	const [range, setRange] = React.useState<OpsHistoryRange>("24h");
	const history = api.operations.serverHistory.useQuery({ serverId: server.id, range }, opsHistoryQuery(range));
	const handleRange = React.useCallback((value: string | number | null): void => {
		setRange(OpsHistoryRangeSchema.parse(value));
	}, []);
	const series = React.useMemo(() => usageSeries(history.data?.data.points ?? []), [history.data]);
	const cpuRows = React.useMemo(() => series.cpu.map((point) => ({ at: point.at, cpu: point.value })), [series.cpu]);
	const health = HEALTH_PRESENTATION[server.health];
	const { live } = server;
	const storage = live === null || live.disks.length === 0 ? null : storageTotals(live.disks);
	const memoryPercent = live === null ? null : percentOf(live.memoryUsedBytes, live.memoryTotalBytes);
	const storagePercent = storage === null ? null : percentOf(storage.usedBytes, storage.totalBytes);
	return (
		<section aria-labelledby={`server-${server.id}`} className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2">
						<ProviderIcon provider={server.provider} className="size-5" />
						<h2 id={`server-${server.id}`} className="truncate text-lg font-semibold">
							{server.name}
						</h2>
						<StatusBadge tone={health.tone}>{health.label}</StatusBadge>
					</div>
					<p className="truncate text-sm text-muted-foreground">
						{PROVIDER_LABELS[server.provider]} · {server.hostname ?? "agent not reporting yet"} · last report {formatAgo(server.lastSeenAt, now)}
					</p>
					<p className="truncate text-xs text-muted-foreground">{machineSpecLine(server)}</p>
				</div>
				<Button variant="outline" size="sm" nativeButton={false} render={<Link href={ROUTES.operations.server(server.id)} />}>
					Server details
					<ArrowUpRight className="size-4" />
				</Button>
			</div>
			<Card className="gap-0 overflow-hidden p-0">
				<div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
					<div>
						<p className="text-base font-semibold">CPU usage</p>
						<p className="text-xs text-muted-foreground">Average of every core, per {range === "1h" || range === "24h" ? "minute" : "hour"}</p>
					</div>
					<Tabs value={range} onValueChange={handleRange}>
						<TabsList>
							{FOCUS_RANGES.map((option) => (
								<TabsTrigger key={option} value={option}>
									{option}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
				{cpuRows.length < 2 ? (
					<p className="border-t px-5 py-16 text-center text-sm text-muted-foreground">{history.isLoading ? "Loading…" : "No history in this range yet."}</p>
				) : (
					<AreaTrendChart
						title={`${server.name} CPU over ${RANGE_WORDS[range]}`}
						rows={cpuRows}
						series={CPU_SERIES}
						format={formatPercent}
						domain={PERCENT_DOMAIN}
						className="h-72 border-t"
					/>
				)}
			</Card>
			<div className="grid gap-4 md:grid-cols-3">
				<SparkStatCard
					title="CPU"
					value={formatPercent(live?.cpuPercent ?? null)}
					detail={live === null ? "Not reporting" : `load ${live.load1.toFixed(2)} · ${String(live.perCorePercent.length)} cores`}
					change={shareChange(series.cpu.at(0)?.value, series.cpu.at(-1)?.value, range)}
					points={series.cpu}
					format={formatPercent}
					domain={PERCENT_DOMAIN}
				/>
				<SparkStatCard
					title="Memory"
					value={formatPercent(memoryPercent)}
					detail={
						live === null
							? "Not reporting"
							: `${formatBytes(live.memoryUsedBytes)} of ${formatBytes(live.memoryTotalBytes)} · ${formatBytes(live.memoryTotalBytes - live.memoryUsedBytes)} free`
					}
					change={shareChange(series.memory.at(0)?.value, series.memory.at(-1)?.value, range)}
					points={series.memory}
					format={formatPercent}
					domain={PERCENT_DOMAIN}
				/>
				<SparkStatCard
					title="Storage"
					value={formatPercent(storagePercent)}
					detail={
						storage === null
							? "Not reporting"
							: `${formatBytes(storage.usedBytes)} of ${formatBytes(storage.totalBytes)} · ${formatBytes(storage.totalBytes - storage.usedBytes)} free`
					}
					change={shareChange(series.disk.at(0)?.value, series.disk.at(-1)?.value, range)}
					points={series.disk}
					format={formatPercent}
					domain={PERCENT_DOMAIN}
				/>
			</div>
		</section>
	);
}
