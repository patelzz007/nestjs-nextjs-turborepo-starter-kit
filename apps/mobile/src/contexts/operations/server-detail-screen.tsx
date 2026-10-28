// One server on the phone (ADR 068): CPU and memory over a chosen range (touch the chart for any
// moment), its figures now, and its spec — what the machine is, and how much RAM, swap and storage it
// has, uses and has free. Both queries are cached by TanStack Query and refresh on their own pace.

import {
	formatBytes,
	formatPercent,
	formatUptime,
	OPS_HISTORY_RANGES,
	OPS_HOUR_MS,
	OPS_MINUTE_MS,
	OPS_SAMPLE_INTERVAL_MS,
	percentOf,
	storageTotals,
	type OpsHistoryRange,
	type OpsServerDetail,
} from "@workspace/shared";
import { Card } from "@workspace/ui-native/components/card";
import { DetailList, type DetailItem } from "@workspace/ui-native/components/detail-list";
import { EmptyState, ErrorState } from "@workspace/ui-native/components/empty";
import { SegmentedControl } from "@workspace/ui-native/components/segmented-control";
import { StatTiles } from "@workspace/ui-native/components/stat-tiles";
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import { useLocalSearchParams } from "expo-router";
import ActivityIcon from "lucide-react-native/icons/activity";
import * as React from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { ProgressList, type ProgressItem } from "../../components/progress-list";
import { Screen } from "../../components/screen";
import { TrendChart, type TrendSeries } from "../../components/trend-chart";
import { useApi } from "../../lib/api-context";
import { bucketLabel, HEALTH_PRESENTATION, MOBILE_RANGES, PROVIDER_LABELS, tickLabel, usageBuckets } from "./presentation";

const ServerRouteParamsSchema = z.object({ serverId: z.uuid() });
const HUNDRED = 100;

/** The server's live figures as tiles. */
export function liveTiles(server: OpsServerDetail): { label: string; value: string }[] {
	const { live } = server;
	if (live === null) {
		return [];
	}
	const storage = storageTotals(live.disks);
	return [
		{ label: "CPU", value: formatPercent(live.cpuPercent) },
		{ label: "Memory", value: formatPercent(percentOf(live.memoryUsedBytes, live.memoryTotalBytes)) },
		{ label: "Storage", value: storage.totalBytes === 0 ? "—" : formatPercent(percentOf(storage.usedBytes, storage.totalBytes)) },
		{ label: "Load", value: live.load1.toFixed(2) },
	];
}

/** What the machine is and how much of it is in use: size, used and free of each resource. */
export function specItems(server: OpsServerDetail): DetailItem[] {
	const { live } = server;
	const storage = live === null ? null : storageTotals(live.disks);
	const usedFree = (used: number, total: number): string => `${formatBytes(used)} used · ${formatBytes(Math.max(0, total - used))} free`;
	return [
		{ label: "CPU", value: server.cpuModel ?? "—" },
		{ label: "Cores", value: server.cpuCores === null ? "—" : String(server.cpuCores) },
		{ label: "RAM", value: formatBytes(live?.memoryTotalBytes ?? server.memoryTotalBytes) },
		...(live === null ? [] : [{ label: "RAM in use", value: usedFree(live.memoryUsedBytes, live.memoryTotalBytes) }]),
		...(live === null || live.swapTotalBytes === 0
			? []
			: [
					{ label: "Swap", value: formatBytes(live.swapTotalBytes) },
					{ label: "Swap in use", value: usedFree(live.swapUsedBytes, live.swapTotalBytes) },
				]),
		{ label: "Storage", value: storage === null || storage.totalBytes === 0 ? "—" : formatBytes(storage.totalBytes) },
		...(storage === null || storage.totalBytes === 0 ? [] : [{ label: "Storage in use", value: usedFree(storage.usedBytes, storage.totalBytes) }]),
		{ label: "Operating system", value: server.os ?? "—" },
		{ label: "Hostname", value: server.hostname ?? "—" },
		{ label: "Uptime", value: formatUptime(server.uptimeSeconds) },
	];
}

/** Each mounted disk as a bar. */
export function diskItems(server: OpsServerDetail): ProgressItem[] {
	return (server.live?.disks ?? []).map((disk) => ({
		key: disk.mount,
		label: disk.mount,
		detail: `${formatBytes(disk.usedBytes)} of ${formatBytes(disk.totalBytes)}`,
		value: percentOf(disk.usedBytes, disk.totalBytes),
		max: HUNDRED,
		valueLabel: formatPercent(percentOf(disk.usedBytes, disk.totalBytes)),
	}));
}

function HistoryCard({ serverId }: { readonly serverId: string }): React.JSX.Element {
	const api = useApi();
	const [range, setRange] = React.useState<OpsHistoryRange>("24h");
	const bucketMs = OPS_HISTORY_RANGES[range].resolution === "MINUTE" ? OPS_MINUTE_MS : OPS_HOUR_MS;
	const history = api.operations.serverHistory.useQuery({ serverId, range }, { staleTime: bucketMs, refetchInterval: bucketMs });
	const buckets = React.useMemo(() => usageBuckets(history.data?.data.points ?? []), [history.data]);
	const series: TrendSeries[] = React.useMemo(
		() => [
			{ key: "cpu", label: "CPU", color: "chart-1", values: buckets.map((bucket) => bucket.cpu) },
			{ key: "memory", label: "Memory", color: "chart-3", values: buckets.map((bucket) => bucket.memory) },
		],
		[buckets],
	);
	const bucketLabels = React.useMemo(() => buckets.map((bucket) => bucketLabel(bucket.at)), [buckets]);
	const tickLabels = React.useMemo(() => buckets.map((bucket) => tickLabel(bucket.at, range)), [buckets, range]);
	return (
		<Card title="CPU and memory" description="Average share of the machine in each bucket.">
			<View className="gap-3">
				<SegmentedControl label="History range" options={MOBILE_RANGES} value={range} onChange={setRange} loading={history.isFetching ? history.data === undefined : false} />
				{buckets.length < 2 ? (
					<Text className="font-sans text-sm text-muted-foreground">{history.isLoading ? "Loading…" : "No history in this range yet."}</Text>
				) : (
					<TrendChart
						title="CPU and memory over time"
						series={series}
						bucketLabels={bucketLabels}
						tickLabels={tickLabels}
						formatValue={formatPercent}
						formatTick={formatPercent}
						hint="Touch the chart to see any moment"
						testID="server-history"
					/>
				)}
			</View>
		</Card>
	);
}

export function ServerDetailScreen(): React.JSX.Element {
	const params = ServerRouteParamsSchema.safeParse(useLocalSearchParams());
	if (!params.success) {
		return (
			<Screen>
				<EmptyState title="This server could not be opened" message="Go back to Servers and pick it again." />
			</Screen>
		);
	}
	return <ServerDetail serverId={params.data.serverId} />;
}

function ServerDetail({ serverId }: { readonly serverId: string }): React.JSX.Element {
	const api = useApi();
	const detail = api.operations.server.useQuery({ serverId }, { staleTime: OPS_SAMPLE_INTERVAL_MS, refetchInterval: OPS_SAMPLE_INTERVAL_MS });
	const refresh = React.useCallback((): void => {
		void detail.refetch();
	}, [detail]);
	const server = detail.data?.data;
	if (server === undefined) {
		return (
			<Screen>
				{detail.isError ? (
					<ErrorState message="This server could not be loaded." retryLabel="Try again" onRetry={refresh} retrying={detail.isRefetching} />
				) : (
					<Text className="font-sans text-sm text-muted-foreground">Loading…</Text>
				)}
			</Screen>
		);
	}
	const health = HEALTH_PRESENTATION[server.health];
	const tiles = liveTiles(server);
	const disks = diskItems(server);
	return (
		<Screen
			title={server.name}
			description={`${PROVIDER_LABELS[server.provider]} · ${server.hostname ?? "agent not reporting yet"}`}
			refreshing={detail.isRefetching}
			onRefresh={refresh}>
			<View className="gap-4">
				<StatusBadge icon={ActivityIcon} label={health.label} accessibilityLabel={`Health: ${health.label}`} tone={health.tone} pulsing={server.health === "UP"} />
				{tiles.length === 0 ? (
					<Text className="font-sans text-sm text-muted-foreground">No live sample: the agent has not reported in the last 30 seconds.</Text>
				) : (
					<StatTiles items={tiles} testID="server-live" />
				)}
				<HistoryCard serverId={server.id} />
				<Card title="Machine" description="What it is, and how much of it is in use now.">
					<DetailList items={specItems(server)} testID="server-spec" />
				</Card>
				{disks.length < 2 ? null : (
					<Card title="Disks">
						<ProgressList items={disks} testID="server-disks" />
					</Card>
				)}
			</View>
		</Screen>
	);
}
