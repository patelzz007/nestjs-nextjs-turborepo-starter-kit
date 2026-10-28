"use client";

// The operations console's landing page (ADR 068): every server with live gauges, every instance's
// heartbeat, every dependency's latest check and the open alerts — refreshed every 10 seconds.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { OPS_SAMPLE_INTERVAL_MS, type OpsDependencyStatus, type OpsInstance, type OpsServerCredentials, type OpsServerProvider } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Server } from "lucide-react";
import * as React from "react";

import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { toastMutationError } from "@/lib/api/mutation-error";
import { useSuperAdminStatus } from "@/lib/session/super-admin";

import { useCloseOnDismiss, useNow, useTextField } from "../lib/use-ops-hooks";
import { formatAgo, formatBytes, formatCount, formatMs, formatPercent, formatUptime, HEALTH_PRESENTATION } from "../lib/ops-format";
import { OPS_LIVE_QUERY } from "../lib/ops-queries";
import { OpenAlertsList } from "./open-alerts-list";
import { AgentCredentials } from "./agent-credentials";
import { PROVIDER_LABELS, ProviderIcon } from "./provider-icon";
import { ServerFocus } from "./server-focus";

/** The providers to choose from, in the order the picker lists them (clouds first). */
const PROVIDER_ORDER: readonly OpsServerProvider[] = ["DIGITALOCEAN", "LINODE", "VULTR", "HETZNER", "LOCAL", "OTHER"];
const PROVIDER_OPTIONS: readonly SelectOption<OpsServerProvider>[] = PROVIDER_ORDER.map((provider) => ({ value: provider, label: PROVIDER_LABELS[provider] }));

function InstancesTable({ instances, now, loading }: { readonly instances: readonly OpsInstance[]; readonly now: number; readonly loading: boolean }): React.JSX.Element {
	const columns = React.useMemo(
		(): ColumnDef<DataTableFeatures, OpsInstance>[] => [
			{
				accessorKey: "service",
				header: "Instance",
				cell: ({ row }) => (
					<div className="min-w-0">
						<p className="font-medium">{row.original.service}</p>
						<p className="truncate text-xs text-muted-foreground">
							{row.original.hostname} · pid {String(row.original.pid)} · seen {formatAgo(row.original.sampledAt, now)}
						</p>
					</div>
				),
			},
			{
				accessorKey: "health",
				header: "State",
				cell: ({ row }) => <StatusBadge tone={HEALTH_PRESENTATION[row.original.health].tone}>{HEALTH_PRESENTATION[row.original.health].label}</StatusBadge>,
			},
			{ accessorKey: "cpuPercent", header: "CPU", cell: ({ row }) => <span className="tabular-nums">{formatPercent(row.original.cpuPercent)}</span> },
			{ accessorKey: "rssBytes", header: "Memory", cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.rssBytes)}</span> },
			{ accessorKey: "requestsPerMinute", header: "Requests / min", cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.requestsPerMinute)}</span> },
			{ accessorKey: "latencyP95Ms", header: "p95", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.latencyP95Ms)}</span> },
			{
				accessorKey: "serverErrorsPerMinute",
				header: "5xx / min",
				cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.serverErrorsPerMinute)}</span>,
			},
			{ accessorKey: "eventLoopLagP99Ms", header: "Event loop p99", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.eventLoopLagP99Ms)}</span> },
			{ accessorKey: "startedAt", header: "Up", cell: ({ row }) => <span className="tabular-nums">{formatUptime((now - row.original.startedAt) / MS_PER_SECOND)}</span> },
		],
		[now],
	);
	return (
		<DataTable
			columns={columns}
			data={instances}
			searchKeys={INSTANCE_SEARCH_KEYS}
			isLoading={loading}
			emptyState={INSTANCES_EMPTY}
			persistKey="ops-instances"
			enableColumnVisibility
		/>
	);
}

const MS_PER_SECOND = 1_000;
const INSTANCE_SEARCH_KEYS: string[] = ["service", "hostname"];
const INSTANCES_EMPTY: EmptyStateConfig = { title: "No instance has reported yet", description: "Each API process reports itself every 10 seconds once it starts." };

/** A dependency's headline figure, by kind. */
export function dependencySummary(status: OpsDependencyStatus): string {
	if (!status.configured) {
		return "Not used by this deployment";
	}
	const { stats } = status;
	if (stats === null) {
		return status.error ?? "No answer";
	}
	switch (stats.dependency) {
		case "POSTGRES":
			return `${String(stats.connectionsUsed)}/${String(stats.connectionsMax)} connections · ${formatBytes(stats.sizeBytes)} · cache hit ${formatPercent(stats.cacheHitPercent)}`;
		case "REDIS":
			return `${formatBytes(stats.usedMemoryBytes)} used · ${String(stats.connectedClients)} clients · ${stats.opsPerSecond.toFixed(0)} ops/s`;
		case "QUEUES": {
			const waiting = stats.queues.reduce((sum, queue) => sum + queue.waiting + queue.delayed, 0);
			const failed = stats.queues.reduce((sum, queue) => sum + queue.failed, 0);
			return `${String(stats.queues.length)} queues · ${String(waiting)} waiting · ${String(failed)} failed`;
		}
		case "KAFKA":
			return `${String(stats.brokers)} broker${stats.brokers === 1 ? "" : "s"} · lag ${stats.consumerLag === null ? "not measured" : String(stats.consumerLag)}`;
		case "RABBITMQ":
			return stats.connected ? "Accepting connections" : "Not accepting connections";
		case "ENDPOINTS": {
			const up = stats.endpoints.filter((endpoint) => endpoint.up).length;
			return `${String(up)}/${String(stats.endpoints.length)} public addresses answering`;
		}
	}
}

/** How each dependency reads. */
export const DEPENDENCY_LABELS: Readonly<Record<OpsDependencyStatus["dependency"], string>> = {
	POSTGRES: "PostgreSQL",
	REDIS: "Redis",
	QUEUES: "Job queues",
	KAFKA: "Kafka",
	RABBITMQ: "RabbitMQ",
	ENDPOINTS: "Public endpoints",
};

function DependencyGrid({ dependencies }: { readonly dependencies: readonly OpsDependencyStatus[] }): React.JSX.Element {
	if (dependencies.length === 0) {
		return <p className="text-sm text-muted-foreground">The first check runs within a minute of the API starting.</p>;
	}
	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{dependencies.map((dependency) => (
				<div key={dependency.dependency} className="rounded-lg border p-3">
					<div className="flex items-center justify-between gap-2">
						<span className="font-medium">{DEPENDENCY_LABELS[dependency.dependency]}</span>
						<StatusBadge tone={HEALTH_PRESENTATION[dependency.health].tone}>{dependency.configured ? HEALTH_PRESENTATION[dependency.health].label : "Not used"}</StatusBadge>
					</div>
					<p className="mt-1 text-xs text-muted-foreground">{dependencySummary(dependency)}</p>
					{dependency.latencyMs !== null ? <p className="mt-1 text-xs text-muted-foreground tabular-nums">answered in {formatMs(dependency.latencyMs)}</p> : null}
				</div>
			))}
		</div>
	);
}

function RegisterServerDialog({ onClose }: { readonly onClose: () => void }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [name, setName] = React.useState("");
	const [provider, setProvider] = React.useState<OpsServerProvider>("DIGITALOCEAN");
	const [providerServerId, setProviderServerId] = React.useState("");
	const [credentials, setCredentials] = React.useState<OpsServerCredentials | null>(null);
	const register = api.operations.registerServer.useMutation({
		onSuccess: async (result): Promise<void> => {
			setCredentials(result.data);
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.overview.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not register the server", error);
		},
	});
	const isCloud = provider !== "LOCAL" && provider !== "OTHER";
	const handleOpenChange = useCloseOnDismiss(onClose);
	const handleName = useTextField(setName);
	const handleProviderServerId = useTextField(setProviderServerId);
	const handleProvider = React.useCallback((next: OpsServerProvider | null): void => {
		if (next !== null) {
			setProvider(next);
		}
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			register.mutate({ name, provider, providerServerId: isCloud && providerServerId.trim() !== "" ? providerServerId.trim() : null });
		},
		[register, name, provider, providerServerId, isCloud],
	);
	if (credentials !== null) {
		return <AgentCredentials credentials={credentials} onClose={onClose} />;
	}
	return (
		<Dialog open onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Register a server</DialogTitle>
					<DialogDescription>
						Its agent gets a token of its own. With the provider&apos;s API token configured, the console also shows the provider&apos;s view of it.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-1">
						<Label htmlFor="server-name">Name</Label>
						<Input id="server-name" value={name} onChange={handleName} placeholder="web-01" required maxLength={100} />
					</div>
					<div className="space-y-1">
						<Label htmlFor="server-provider">Where it runs</Label>
						<Select items={PROVIDER_OPTIONS} value={provider} onValueChange={handleProvider}>
							<SelectTrigger id="server-provider" className="w-full">
								<SelectValue>
									<ProviderIcon provider={provider} />
									<span className="truncate">{PROVIDER_LABELS[provider]}</span>
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{PROVIDER_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										<span className="flex items-center gap-2">
											<ProviderIcon provider={option.value} />
											{option.label}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{isCloud ? (
						<div className="space-y-1">
							<Label htmlFor="server-provider-id">{PROVIDER_LABELS[provider]} server id (optional)</Label>
							<Input id="server-provider-id" value={providerServerId} onChange={handleProviderServerId} placeholder="512345678" maxLength={64} />
						</div>
					) : null}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={register.isPending || name.trim() === ""}>
							{register.isPending ? "Registering…" : "Register server"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export function OperationsOverview(): React.JSX.Element {
	const { api } = useAuth();
	const { isSuperAdmin } = useSuperAdminStatus();
	const [registering, setRegistering] = React.useState(false);
	const overview = api.operations.overview.useQuery(undefined, OPS_LIVE_QUERY);
	const data = overview.data?.data;
	const now = useNow(OPS_SAMPLE_INTERVAL_MS);
	const openRegister = React.useCallback((): void => {
		setRegistering(true);
	}, []);
	const closeRegister = React.useCallback((): void => {
		setRegistering(false);
	}, []);
	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
					<p className="text-sm text-muted-foreground">Every server, instance and dependency of the platform, live. Updates every 10 seconds.</p>
				</div>
				{isSuperAdmin ? (
					<Button type="button" onClick={openRegister}>
						<Plus className="size-4" />
						Register server
					</Button>
				) : null}
			</header>
			{data !== undefined && data.openAlerts.length > 0 ? <OpenAlertsList alerts={data.openAlerts} /> : null}
			<section aria-labelledby="servers-heading" className="space-y-3">
				<h2 id="servers-heading" className="text-lg font-semibold">
					Servers
				</h2>
				{data === undefined ? (
					<p className="text-sm text-muted-foreground">{overview.isError ? "The servers could not be loaded." : "Loading…"}</p>
				) : data.servers.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<Server className="size-6" />
							<EmptyTitle>No servers yet</EmptyTitle>
							<EmptyDescription>Register a server, then start its agent with the command you are given.</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="space-y-10">
						{data.servers.map((server) => (
							<ServerFocus key={server.id} server={server} now={now} />
						))}
					</div>
				)}
			</section>
			<section aria-labelledby="instances-heading" className="space-y-3">
				<h2 id="instances-heading" className="text-lg font-semibold">
					Instances
				</h2>
				<InstancesTable instances={data?.instances ?? []} now={now} loading={data === undefined} />
			</section>
			<section aria-labelledby="dependencies-heading" className="space-y-3">
				<h2 id="dependencies-heading" className="text-lg font-semibold">
					Dependencies
				</h2>
				{data === undefined ? null : <DependencyGrid dependencies={data.dependencies} />}
			</section>
			{registering ? <RegisterServerDialog onClose={closeRegister} /> : null}
		</div>
	);
}
