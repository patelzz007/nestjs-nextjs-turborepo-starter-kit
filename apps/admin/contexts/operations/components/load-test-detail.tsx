"use client";

// One load test (ADR 068): its requests per second, latency and errors second by second, the
// servers' CPU on the same timeline, which step of the journey is slow, and its verdict. Live while it
// runs; abort from here. Also: two runs side by side.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LOAD_TEST_ABORT_CPU_PERCENT, LOAD_TEST_ABORT_ERROR_PERCENT, type LoadTestRunDetail, type LoadTestStepStat } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

import { formatCount, formatDateTimeShort, formatMs, formatPercent, percentOf } from "../lib/ops-format";
import { OPS_LIST_QUERY } from "../lib/ops-queries";
import { describeRunTarget, LOAD_TEST_STATUS_PRESENTATION } from "../lib/load-test-presentation";
import { MetricChart } from "./metric-chart";

/** Shares are drawn on a fixed 0–100% axis, so a quiet machine looks quiet. */
const PERCENT_DOMAIN: [number, number] = [0, 100];

const LIVE_REFRESH_MS = 1_000;

/** A count with no decimals. */
function formatWholeNumber(value: number): string {
	return value.toFixed(0);
}

function Stat({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
	return (
		<div>
			<dt className="text-xs text-muted-foreground">{label}</dt>
			<dd className="text-lg font-semibold tabular-nums">{value}</dd>
		</div>
	);
}

function RunSummary({ detail }: { readonly detail: LoadTestRunDetail }): React.JSX.Element {
	const { run } = detail;
	return (
		<dl className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
			<Stat label="Requests" value={formatCount(run.totalRequests)} />
			<Stat label="Errors" value={run.totalRequests === null || run.failedRequests === null ? "—" : formatPercent(percentOf(run.failedRequests, run.totalRequests))} />
			<Stat label="p50" value={formatMs(run.p50Ms)} />
			<Stat label="p95" value={formatMs(run.p95Ms)} />
			<Stat label="p99" value={formatMs(run.p99Ms)} />
			<Stat label="Peak rps" value={run.peakRps === null ? "—" : run.peakRps.toFixed(0)} />
		</dl>
	);
}

function RunCharts({ detail }: { readonly detail: LoadTestRunDetail }): React.JSX.Element {
	const traffic = detail.points.map((point) => ({ at: point.at, values: { requests: point.requests, failures: point.failures } }));
	const latency = detail.points.map((point) => ({ at: point.at, values: { p50: point.p50Ms ?? 0, p95: point.p95Ms ?? 0, p99: point.p99Ms ?? 0 } }));
	const reported: boolean = detail.servers.some((server) => server.points.length > 0);
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Requests and errors per second</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="Requests and errors per second"
						format={formatWholeNumber}
						rows={traffic}
						series={[
							{ key: "requests", label: "Requests", color: "chart-1" },
							{ key: "failures", label: "Errors", color: "chart-4" },
						]}
					/>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Latency</CardTitle>
				</CardHeader>
				<CardContent>
					<MetricChart
						title="Latency percentiles per second"
						format={formatMs}
						rows={latency}
						series={[
							{ key: "p50", label: "p50", color: "chart-1" },
							{ key: "p95", label: "p95", color: "chart-2" },
							{ key: "p99", label: "p99", color: "chart-3" },
						]}
					/>
				</CardContent>
			</Card>
			<Card className="lg:col-span-2">
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Servers during the run</CardTitle>
					<CardDescription>{reported ? "CPU and memory by minute, over the same window." : "No server reported during this run."}</CardDescription>
				</CardHeader>
				<CardContent>
					{!reported ? null : (
						<div className="grid gap-4 md:grid-cols-2">
							{detail.servers.map((server) => (
								<MetricChart
									key={server.serverId}
									title={`${server.name} during the run`}
									format={formatPercent}
									domain={PERCENT_DOMAIN}
									rows={server.points.map((point) => ({ at: point.at, values: { cpu: point.cpuPercent, memory: point.memoryPercent } }))}
									series={[
										{ key: "cpu", label: `${server.name} CPU`, color: "chart-1" },
										{ key: "memory", label: `${server.name} memory`, color: "chart-3" },
									]}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

const STEP_COLUMNS: ColumnDef<DataTableFeatures, LoadTestStepStat>[] = [
	{ accessorKey: "step", header: "Step", cell: ({ row }) => <span className="font-medium">{row.original.step}</span> },
	{ accessorKey: "requests", header: "Requests", cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.requests)}</span> },
	{ accessorKey: "failures", header: "Errors", cell: ({ row }) => <span className="tabular-nums">{formatCount(row.original.failures)}</span> },
	{ accessorKey: "p50Ms", header: "p50", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.p50Ms)}</span> },
	{ accessorKey: "p95Ms", header: "p95", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.p95Ms)}</span> },
	{ accessorKey: "p99Ms", header: "p99", cell: ({ row }) => <span className="tabular-nums">{formatMs(row.original.p99Ms)}</span> },
];
const STEPS_EMPTY: EmptyStateConfig = { title: "No steps measured yet" };

/** The run's steps, slowest (p95) first; sortable by any column. */
function StepTable({ detail }: { readonly detail: LoadTestRunDetail }): React.JSX.Element {
	const steps = React.useMemo(() => [...detail.steps].sort((left, right) => (right.p95Ms ?? 0) - (left.p95Ms ?? 0)), [detail.steps]);
	return <DataTable columns={STEP_COLUMNS} data={steps} emptyState={STEPS_EMPTY} />;
}

export function LoadTestDetail({ runId }: { readonly runId: string }): React.JSX.Element {
	const { api } = useAuth();
	const query = api.operations.loadTest.useQuery(
		{ runId },
		{
			staleTime: LIVE_REFRESH_MS,
			refetchInterval: (state): number | false =>
				state.state.data?.data.run.status === "QUEUED" || state.state.data?.data.run.status === "RUNNING" ? LIVE_REFRESH_MS : false,
		},
	);
	const abort = api.operations.abortLoadTest.useMutation({
		onSuccess: (): void => {
			toastMessage.success({ title: "Stopping the load test" });
		},
		onError: (error): void => {
			toastMutationError("Could not abort", error);
		},
	});
	const handleAbort = React.useCallback((): void => {
		abort.mutate({ runId });
	}, [abort, runId]);
	const detail = query.data?.data;
	if (detail === undefined) {
		return <p className="text-sm text-muted-foreground">{query.isError ? "This load test could not be loaded." : "Loading…"}</p>;
	}
	const { run } = detail;
	const status = LOAD_TEST_STATUS_PRESENTATION[run.status];
	const active = run.status === "QUEUED" || run.status === "RUNNING";
	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{run.name}</h1>
						<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
					</div>
					<p className="text-sm text-muted-foreground">
						{describeRunTarget(run)} · {run.shape.toLowerCase()} · {String(run.virtualUsers)} users · {String(run.requestsPerSecond)} rps for {String(run.durationSeconds)} s ·
						pass at p95 ≤ {String(run.thresholdP95Ms)} ms and errors ≤ {String(run.thresholdErrorPercent)}% · started {formatDateTimeShort(run.startedAt)}
					</p>
					{run.abortReason === null ? null : <p className="text-sm text-amber-600 dark:text-amber-400">{run.abortReason}</p>}
					{run.error === null ? null : <p className="text-sm text-destructive">{run.error}</p>}
				</div>
				{active ? (
					<Button type="button" variant="destructive" disabled={abort.isPending || run.abortReason !== null} onClick={handleAbort}>
						Abort
					</Button>
				) : null}
			</header>
			{active ? (
				<p className="text-xs text-muted-foreground">
					Live. It stops itself if errors stay above {String(LOAD_TEST_ABORT_ERROR_PERCENT)}% or a server stays above {String(LOAD_TEST_ABORT_CPU_PERCENT)}% CPU for too long.
				</p>
			) : null}
			<Card>
				<CardContent className="pt-4">
					<RunSummary detail={detail} />
				</CardContent>
			</Card>
			<RunCharts detail={detail} />
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-base">Steps, slowest first</CardTitle>
				</CardHeader>
				<CardContent>
					<StepTable detail={detail} />
				</CardContent>
			</Card>
		</div>
	);
}

/** Two runs side by side: their headline numbers, and each run's latency. */
export function LoadTestCompare({ leftId, rightId }: { readonly leftId: string; readonly rightId: string }): React.JSX.Element {
	const { api } = useAuth();
	const left = api.operations.loadTest.useQuery({ runId: leftId }, { staleTime: OPS_LIST_QUERY.staleTime });
	const right = api.operations.loadTest.useQuery({ runId: rightId }, { staleTime: OPS_LIST_QUERY.staleTime });
	const runs = [left.data?.data, right.data?.data];
	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Compare load tests</h1>
			</header>
			<div className="grid gap-4 lg:grid-cols-2">
				{runs.map((detail, index) =>
					detail === undefined ? (
						<p key={`missing-${String(index)}`} className="text-sm text-muted-foreground">
							Loading…
						</p>
					) : (
						<Card key={detail.run.id}>
							<CardHeader>
								<CardTitle>{detail.run.name}</CardTitle>
								<CardDescription>
									{describeRunTarget(detail.run)} · {formatDateTimeShort(detail.run.startedAt)} · {LOAD_TEST_STATUS_PRESENTATION[detail.run.status].label}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<RunSummary detail={detail} />
								<MetricChart
									title={`${detail.run.name} latency`}
									format={formatMs}
									rows={detail.points.map((point) => ({ at: point.at, values: { p95: point.p95Ms ?? 0 } }))}
									series={[{ key: "p95", label: "p95", color: "chart-2" }]}
								/>
								<StepTable detail={detail} />
							</CardContent>
						</Card>
					),
				)}
			</div>
		</div>
	);
}
