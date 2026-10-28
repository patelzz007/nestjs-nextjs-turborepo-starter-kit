// The platform's servers on the phone (ADR 068): each one's health, where it runs, its spec, and how
// much CPU, memory and storage it is using now. Tap a server for its history and its full spec.
// Refreshes every 10 seconds from the cached overview query (TanStack Query); pull to refresh.

import { formatBytes, formatPercent, machineSpecLine, percentOf, storageTotals, type OpsServerSummary } from "@workspace/shared";
import { Card } from "@workspace/ui-native/components/card";
import { EmptyState, ErrorState } from "@workspace/ui-native/components/empty";
import { StatusBadge } from "@workspace/ui-native/components/status-badge";
import { useRouter } from "expo-router";
import ActivityIcon from "lucide-react-native/icons/activity";
import ServerIcon from "lucide-react-native/icons/server";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ProgressList, type ProgressItem } from "../../components/progress-list";
import { Screen } from "../../components/screen";
import { useApi } from "../../lib/api-context";
import { ROUTES } from "../../runtime/routes";
import { OVERVIEW_QUERY_OPTIONS } from "./operations-access";
import { HEALTH_PRESENTATION, PROVIDER_LABELS, SERVERS_TITLE } from "./presentation";

const HUNDRED = 100;

/** A server's usage now, as bars: CPU, memory and storage with what they are made of. */
export function usageItems(server: OpsServerSummary): ProgressItem[] {
	const { live } = server;
	if (live === null) {
		return [];
	}
	const storage = storageTotals(live.disks);
	const memory = percentOf(live.memoryUsedBytes, live.memoryTotalBytes);
	return [
		{
			key: "cpu",
			label: "CPU",
			detail: `load ${live.load1.toFixed(2)} · ${String(live.perCorePercent.length)} cores`,
			value: live.cpuPercent,
			max: HUNDRED,
			valueLabel: formatPercent(live.cpuPercent),
		},
		{
			key: "memory",
			label: "Memory",
			detail: `${formatBytes(live.memoryUsedBytes)} of ${formatBytes(live.memoryTotalBytes)}`,
			value: memory,
			max: HUNDRED,
			valueLabel: formatPercent(memory),
		},
		...(storage.totalBytes === 0
			? []
			: [
					{
						key: "storage",
						label: "Storage",
						detail: `${formatBytes(storage.usedBytes)} of ${formatBytes(storage.totalBytes)}`,
						value: percentOf(storage.usedBytes, storage.totalBytes),
						max: HUNDRED,
						valueLabel: formatPercent(percentOf(storage.usedBytes, storage.totalBytes)),
					},
				]),
	];
}

function ServerCard({ server, onOpen }: { readonly server: OpsServerSummary; readonly onOpen: (serverId: string) => void }): React.JSX.Element {
	const health = HEALTH_PRESENTATION[server.health];
	const items = usageItems(server);
	const open = React.useCallback((): void => {
		onOpen(server.id);
	}, [onOpen, server.id]);
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={`${server.name}, ${health.label}. Open its history`} onPress={open} testID={`server-${server.id}`}>
			<Card>
				<View className="gap-3">
					<View className="flex-row items-start justify-between gap-3">
						<View className="min-w-0 flex-1 gap-0.5">
							<Text className="font-sans-semibold text-base text-foreground" numberOfLines={1}>
								{server.name}
							</Text>
							<Text className="font-sans text-sm text-muted-foreground" numberOfLines={1}>
								{`${PROVIDER_LABELS[server.provider]} · ${server.hostname ?? "agent not reporting yet"}`}
							</Text>
							<Text className="font-sans text-xs text-muted-foreground" numberOfLines={2}>
								{machineSpecLine(server)}
							</Text>
						</View>
						<StatusBadge icon={ActivityIcon} label={health.label} accessibilityLabel={`Health: ${health.label}`} tone={health.tone} pulsing={server.health === "UP"} />
					</View>
					{items.length === 0 ? (
						<Text className="font-sans text-sm text-muted-foreground">No live sample: the agent has not reported in the last 30 seconds.</Text>
					) : (
						<ProgressList items={items} testID={`server-${server.id}-usage`} />
					)}
				</View>
			</Card>
		</Pressable>
	);
}

export function ServersScreen(): React.JSX.Element {
	const api = useApi();
	const router = useRouter();
	const overview = api.operations.overview.useQuery(undefined, OVERVIEW_QUERY_OPTIONS);
	const refresh = React.useCallback((): void => {
		void overview.refetch();
	}, [overview]);
	const open = React.useCallback(
		(serverId: string): void => {
			router.push({ pathname: ROUTES.server, params: { serverId } });
		},
		[router],
	);
	const servers = overview.data?.data.servers;
	return (
		<Screen title={SERVERS_TITLE} description="Every machine the platform runs on, live." refreshing={overview.isRefetching} onRefresh={refresh}>
			{servers === undefined ? (
				overview.isError ? (
					<ErrorState message="The servers could not be loaded." retryLabel="Try again" onRetry={refresh} retrying={overview.isRefetching} />
				) : (
					<Text className="font-sans text-sm text-muted-foreground">Loading…</Text>
				)
			) : servers.length === 0 ? (
				<EmptyState icon={ServerIcon} title="No servers yet" message="A SuperAdmin registers servers in the admin panel." />
			) : (
				<View className="gap-3">
					{servers.map((server) => (
						<ServerCard key={server.id} server={server} onOpen={open} />
					))}
				</View>
			)}
		</Screen>
	);
}
