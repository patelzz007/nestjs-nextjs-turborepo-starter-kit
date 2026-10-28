"use client";

// One server (ADR 068): its facts and its cloud provider's view, its live sample (per core, every
// disk, the busiest processes), and its history over the chosen range.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import {
	OPS_SAMPLE_INTERVAL_MS,
	OpsHistoryRangeSchema,
	type OpsHistoryRange,
	type OpsProcess,
	type OpsServerCredentials,
	type OpsServerDetail,
	type OpsServerPoint,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

import { formatAgo, formatByteRate, formatBytes, formatCount, formatDateTimeShort, formatPercent, HEALTH_PRESENTATION, percentOf } from "../lib/ops-format";
import { useNow } from "../lib/use-ops-hooks";
import { OPS_LIVE_QUERY, opsHistoryQuery } from "../lib/ops-queries";
import { MetricChart } from "./metric-chart";
import { CoreChart } from "./core-chart";
import { MachineSpec } from "./machine-spec";
import { PROVIDER_LABELS, ProviderIcon } from "./provider-icon";
import { AgentCredentials } from "./agent-credentials";

/** Shares are drawn on a fixed 0–100% axis, so a quiet machine looks quiet. */
const PERCENT_DOMAIN: [number, number] = [0, 100];

function Fact({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
	return (
		<div>
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="text-sm font-medium break-words">{value}</dd>
		</div>
	);
}

function HistoryCharts({ points, loading }: { readonly points: readonly OpsServerPoint[]; readonly loading: boolean }): React.JSX.Element {
	const rows = <TKey extends string>(pick: (point: OpsServerPoint) => Record<TKey, number>): { at: number; values: Record<TKey, number> }[] =>
		points.map((point) => ({ at: point.bucketStart, values: pick(point) }));
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">CPU</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="CPU over time"
						loading={loading}
						format={formatPercent}
						domain={PERCENT_DOMAIN}
						rows={rows((point) => ({ avg: point.cpuPercentAvg, max: point.cpuPercentMax }))}
						series={[
							{ key: "avg", label: "Average", color: "chart-1" },
							{ key: "max", label: "Peak", color: "chart-2" },
						]}
					/>
				</CardContent>
			</Card>
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Memory and disk</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="Memory and disk over time"
						loading={loading}
						format={formatPercent}
						domain={PERCENT_DOMAIN}
						rows={rows((point) => ({ memory: percentOf(point.memoryUsedBytes, point.memoryTotalBytes), disk: point.diskPercentMax }))}
						series={[
							{ key: "memory", label: "Memory", color: "chart-1" },
							{ key: "disk", label: "Fullest disk", color: "chart-3" },
						]}
					/>
				</CardContent>
			</Card>
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Network</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="Network over time"
						loading={loading}
						format={formatByteRate}
						rows={rows((point) => ({ rx: point.netRxBytesPerSec, tx: point.netTxBytesPerSec }))}
						series={[
							{ key: "rx", label: "In", color: "chart-1" },
							{ key: "tx", label: "Out", color: "chart-2" },
						]}
					/>
				</CardContent>
			</Card>
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Disk activity</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="Disk reads and writes over time"
						loading={loading}
						format={formatByteRate}
						rows={rows((point) => ({ read: point.diskReadBytesPerSec, write: point.diskWriteBytesPerSec }))}
						series={[
							{ key: "read", label: "Read", color: "chart-1" },
							{ key: "write", label: "Write", color: "chart-4" },
						]}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

const PROCESS_COLUMNS: ColumnDef<DataTableFeatures, OpsProcess>[] = [
	{
		accessorKey: "name",
		header: "Process",
		cell: ({ row }) => (
			<span className="block max-w-40 truncate">
				{row.original.name} <span className="text-xs text-muted-foreground">({String(row.original.pid)})</span>
			</span>
		),
	},
	{ accessorKey: "cpuPercent", header: "CPU", cell: ({ row }) => <span className="tabular-nums">{formatPercent(row.original.cpuPercent)}</span> },
	{ accessorKey: "memoryBytes", header: "Memory", cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.memoryBytes)}</span> },
];
const PROCESS_SEARCH_KEYS: string[] = ["name"];
const PROCESSES_EMPTY: EmptyStateConfig = { title: "No processes reported" };

/** The machine's busiest processes, sortable by CPU or memory. */
function ProcessTable({ processes }: { readonly processes: readonly OpsProcess[] }): React.JSX.Element {
	return <DataTable columns={PROCESS_COLUMNS} data={processes} searchKeys={PROCESS_SEARCH_KEYS} emptyState={PROCESSES_EMPTY} pageSize={PROCESS_PAGE_SIZE} />;
}

const PROCESS_PAGE_SIZE = 10;

function LiveSection({ server }: { readonly server: OpsServerDetail }): React.JSX.Element {
	const { live } = server;
	if (live === null) {
		return <p className="text-sm text-muted-foreground">The agent has not reported in the last 30 seconds.</p>;
	}
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">CPU by core</CardTitle>
					<CardDescription>
						Load {live.load1.toFixed(2)} / {live.load5.toFixed(2)} / {live.load15.toFixed(2)} · steal {formatPercent(live.stealPercent)} · iowait{" "}
						{formatPercent(live.iowaitPercent)}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<CoreChart cores={live.perCorePercent} />
				</CardContent>
			</Card>
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Busiest processes</CardTitle>
					<CardDescription>{formatCount(live.processCount)} processes</CardDescription>
				</CardHeader>
				<CardContent>
					<ProcessTable processes={live.topProcesses} />
				</CardContent>
			</Card>
		</div>
	);
}

export function ServerDetail({ serverId }: { readonly serverId: string }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { isSuperAdmin } = useSuperAdminStatus();
	const [range, setRange] = React.useState<OpsHistoryRange>("1h");
	const [credentials, setCredentials] = React.useState<OpsServerCredentials | null>(null);
	const detail = api.operations.server.useQuery({ serverId }, OPS_LIVE_QUERY);
	const history = api.operations.serverHistory.useQuery({ serverId, range }, opsHistoryQuery(range));
	const rotate = api.operations.rotateServerToken.useMutation({
		onSuccess: (result): void => {
			setCredentials(result.data);
		},
		onError: (error): void => {
			toastMutationError("Could not rotate the token", error);
		},
	});
	const revoke = api.operations.revokeServer.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Server removed" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.overview.queryKey(undefined) });
			router.push(ROUTES.operations.servers);
		},
		onError: (error): void => {
			toastMutationError("Could not remove the server", error);
		},
	});
	const now = useNow(OPS_SAMPLE_INTERVAL_MS);
	const serverName: string = detail.data?.data.name ?? "";
	const handleRotate = React.useCallback((): void => {
		rotate.mutate({ serverId });
	}, [rotate, serverId]);
	const handleRevoke = React.useCallback((): void => {
		if (window.confirm(`Stop monitoring ${serverName}? Its agent's token stops working at once.`)) {
			revoke.mutate({ serverId });
		}
	}, [revoke, serverId, serverName]);
	const handleRange = React.useCallback((value: string | number | null): void => {
		setRange(OpsHistoryRangeSchema.parse(value));
	}, []);
	const closeCredentials = React.useCallback((): void => {
		setCredentials(null);
	}, []);
	const server = detail.data?.data;
	if (server === undefined) {
		return <p className="text-sm text-muted-foreground">{detail.isError ? "This server could not be loaded." : "Loading…"}</p>;
	}
	const health = HEALTH_PRESENTATION[server.health];
	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{server.name}</h1>
						<StatusBadge tone={health.tone}>{health.label}</StatusBadge>
					</div>
					<p className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<ProviderIcon provider={server.provider} />
						{PROVIDER_LABELS[server.provider]} · last report {formatAgo(server.lastSeenAt, now)}
					</p>
				</div>
				{isSuperAdmin ? (
					<div className="flex gap-2">
						<Button type="button" variant="outline" disabled={rotate.isPending} onClick={handleRotate}>
							Rotate agent token
						</Button>
						<Button type="button" variant="destructive" disabled={revoke.isPending} onClick={handleRevoke}>
							Remove server
						</Button>
					</div>
				) : null}
			</header>
			<div className="grid gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="pb-2">
						<CardTitle className="text-base">Machine</CardTitle>
						<CardDescription>What it is, and how much of it is in use right now.</CardDescription>
					</CardHeader>
					<CardContent>
						<MachineSpec server={server} live={server.live} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-base">About</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid gap-4">
							<Fact label="Hostname" value={server.hostname ?? "—"} />
							<Fact label="Operating system" value={server.os ?? "—"} />
							<Fact label="Kernel" value={server.kernel ?? "—"} />
							<Fact label="Agent" value={server.agentVersion ?? "not reporting yet"} />
							<Fact label="Token" value={`${server.tokenPrefix}…`} />
						</dl>
					</CardContent>
				</Card>
			</div>
			{server.cloud !== null || server.cloudError !== null ? (
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="flex items-center gap-2 text-base">
							<ProviderIcon provider={server.provider} />
							{PROVIDER_LABELS[server.provider]}&apos;s view
						</CardTitle>
					</CardHeader>
					<CardContent>
						{server.cloud === null ? (
							<p className="text-sm text-muted-foreground">{server.cloudError}</p>
						) : (
							<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								<Fact label="Name" value={server.cloud.name} />
								<Fact label="Status" value={server.cloud.status} />
								<Fact label="Region" value={server.cloud.region} />
								<Fact label="Plan" value={server.cloud.plan} />
								<Fact
									label="Size"
									value={`${String(server.cloud.vcpus)} vCPU · ${formatBytes(server.cloud.memoryMb * 1_024 * 1_024)} · ${String(server.cloud.diskGb)} GB disk`}
								/>
								<Fact label="Public IPv4" value={server.cloud.publicIpv4 ?? "—"} />
								<Fact label="Created" value={formatDateTimeShort(server.cloud.createdAt)} />
							</dl>
						)}
					</CardContent>
				</Card>
			) : null}
			<section className="space-y-3" aria-labelledby="live-heading">
				<h2 id="live-heading" className="text-lg font-semibold">
					Now
				</h2>
				<LiveSection server={server} />
			</section>
			<section className="space-y-3" aria-labelledby="history-heading">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="history-heading" className="text-lg font-semibold">
						History
					</h2>
					<Tabs value={range} onValueChange={handleRange}>
						<TabsList>
							{OpsHistoryRangeSchema.options.map((option) => (
								<TabsTrigger key={option} value={option}>
									{option}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
				<HistoryCharts points={history.data?.data.points ?? []} loading={history.isLoading} />
			</section>
			{credentials !== null ? <AgentCredentials credentials={credentials} onClose={closeCredentials} /> : null}
		</div>
	);
}
