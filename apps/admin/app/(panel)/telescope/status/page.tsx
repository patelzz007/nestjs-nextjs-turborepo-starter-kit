"use client";

// ============================================
// app/(panel)/telescope/status/page.tsx
// Feature 9 — capture status. Shows the fully-resolved capture config the
// process actually runs with (env + defaults merged), plus the live pipeline
// health snapshot. Also hosts the manual maintenance actions (feature 8):
// "Prune now" drops entries older than the retention window; "Clear all"
// empties every buffer. Both are destructive — they confirm first.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { CalendarClock, Eraser, Play, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { toast } from "sonner";

import type { TelescopeScheduleLog, TelescopeStatus, TelescopeWebhookDelivery } from "@workspace/shared";

import { WebhookDeliveries } from "@/components/telescope/webhook-deliveries";

/** One label/value row inside a config card. */
function ConfigRow({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }): React.JSX.Element {
	return (
		<div className="flex items-baseline justify-between gap-4 border-b px-4 py-2 text-sm last:border-b-0">
			<span className="text-muted-foreground">{label}</span>
			<span className={`text-right ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</span>
		</div>
	);
}

/** Boolean → human label (never raw true/false in the UI). */
function yesNo(value: boolean): string {
	return value ? "On" : "Off";
}

/** Comma-joined list with an empty-state fallback. */
function listLabel(items: readonly string[]): string {
	return items.length > 0 ? items.join(", ") : "—";
}

export default function TelescopeStatusPage(): React.JSX.Element {
	const { api } = useAuth();

	const statusQuery = api.procedure(telescopeEndpoints.status()).useQuery();
	const status: TelescopeStatus | undefined = statusQuery.data?.data;

	// Demo wiring: the deliveries strip + "Run demo schedule now" button make
	// the status page live out of the box (seed rows exist on every boot).
	const deliveriesQuery = api.procedure(telescopeEndpoints.webhookDeliveries()).useQuery();
	const deliveries: readonly TelescopeWebhookDelivery[] = deliveriesQuery.data?.data.items ?? [];
	const runScheduleMutation = api.procedure(telescopeEndpoints.runSchedule("telescope-demo")).useMutation();

	const pruneMutation = api.procedure(telescopeEndpoints.prune(false)).useMutation();
	const clearAllMutation = api.procedure(telescopeEndpoints.clearAll()).useMutation();

	const handleRunDemo = useCallback((): void => {
		runScheduleMutation.mutate(
			{},
			{
				onSuccess: (result): void => {
					const run: TelescopeScheduleLog = result.data;
					toast.success(`"telescope-demo" ran — ${String(run.lastDurationMs)} ms.`);
				},
				onError: (): void => {
					toast.error("Failed to run the demo schedule — check the API logs.");
				},
			},
		);
	}, [runScheduleMutation]);

	const handlePrune = useCallback((): void => {
		if (!window.confirm("Prune entries older than the retention window? This permanently removes old captures.")) {
			return;
		}
		pruneMutation.mutate(
			{},
			{
				onSuccess: (result): void => {
					toast.success(`Pruned ${String(result.data.removed)} entries.`);
					void statusQuery.refetch();
				},
				onError: (): void => {
					toast.error("Failed to prune — check the API logs.");
				},
			},
		);
	}, [pruneMutation, statusQuery]);

	const handleClearAll = useCallback((): void => {
		if (!window.confirm("Clear ALL captured telescope data (requests, SQL, exceptions, jobs, alerts)? This cannot be undone.")) {
			return;
		}
		clearAllMutation.mutate(
			{},
			{
				onSuccess: (): void => {
					toast.success("All telescope data cleared.");
					void statusQuery.refetch();
				},
				onError: (): void => {
					toast.error("Failed to clear — check the API logs.");
				},
			},
		);
	}, [clearAllMutation, statusQuery]);

	if (statusQuery.isLoading || status === undefined) {
		return (
			<div className="mx-auto w-full max-w-5xl space-y-6">
				<header className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Capture status</h1>
					<p className="text-sm text-muted-foreground">Loading…</p>
				</header>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Capture status</h1>
					<p className="text-sm text-muted-foreground">
						The resolved capture configuration this process runs with ({status.environment.nodeEnv} · {status.environment.host}).
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button variant="outline" size="sm" onClick={handlePrune} disabled={pruneMutation.isPending}>
						<RefreshCw className="size-4" />
						Prune old
					</Button>
					<Button variant="destructive" size="sm" onClick={handleClearAll} disabled={clearAllMutation.isPending}>
						<Eraser className="size-4" />
						Clear all
					</Button>
				</div>
			</header>

			{!status.enabled ? (
				<div className="flex items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-500/10 p-4 text-sm text-amber-700 dark:border-amber-500/40 dark:text-amber-400">
					<TriangleAlert className="size-5 shrink-0" />
					<span>
						Capture is <strong>disabled</strong>. In production it fail-closes unless explicitly enabled — nothing new will be recorded.
					</span>
				</div>
			) : null}

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Demo — try it out</CardTitle>
						<CardDescription>The demo schedule fires a "demo-job" every minute; run it now to see it live.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3 p-4">
						<div className="flex flex-wrap items-center gap-2">
							<Button size="sm" onClick={handleRunDemo} disabled={runScheduleMutation.isPending}>
								{runScheduleMutation.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
								Run demo schedule now
							</Button>
							<Link href="/telescope/schedules" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline">
								<CalendarClock className="size-3.5" />
								Open schedules
							</Link>
						</div>
						<div className="rounded-md border bg-muted/40 p-3">
							<p className="mb-2 text-xs font-medium text-muted-foreground">Recent webhook deliveries</p>
							<WebhookDeliveries deliveries={deliveries} isLoading={deliveriesQuery.isLoading} />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Pipeline health</CardTitle>
						<CardDescription>Live snapshot of the capture buffers.</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<ConfigRow label="Enabled" value={yesNo(status.enabled)} />
						<ConfigRow label="Storage" value={status.storage === "postgres" ? "Postgres (persistent)" : "Memory (restart clears)"} mono />
						<ConfigRow label="Buffer" value={`${String(status.bufferRequests)} / ${String(status.bufferCap)} requests`} mono />
						<ConfigRow label="Retention" value={`${String(status.retentionMinutes)} minutes`} mono />
						<ConfigRow label="Sample rate" value={`dev ${(status.sampleRateDev * 100).toFixed(0)}% · prod ${(status.sampleRateProd * 100).toFixed(1)}%`} mono />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Capture options</CardTitle>
						<CardDescription>Body/header limits and the PII policy.</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<ConfigRow label="Body capture" value={status.captureBody === "full" ? "Full" : status.captureBody === "headers" ? "Headers only" : "None"} />
						<ConfigRow label="Body limit" value={`${String(status.maxBodyChars)} chars`} mono />
						<ConfigRow label="PII mode" value={status.piiMode === "redact" ? "Redact" : "Flag only"} />
						<ConfigRow label="Headers kept" value={listLabel(status.captureHeaders)} mono />
						<ConfigRow label="Max spans / request" value={String(status.maxSpansPerRequest)} mono />
						<ConfigRow label="Max console lines" value={String(status.maxConsoleEntriesPerRequest)} mono />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Path rules</CardTitle>
						<CardDescription>Which routes are captured vs. ignored.</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<ConfigRow label="Capture only" value={status.capturePaths.length > 0 ? listLabel(status.capturePaths) : "Everything (no allowlist)"} mono />
						<ConfigRow label="Ignored" value={listLabel(status.ignorePaths)} mono />
						<ConfigRow label="Redacted" value={listLabel(status.redactPaths)} mono />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-base">Threshold alerts</CardTitle>
						<CardDescription>Alert evaluation + webhook delivery config.</CardDescription>
					</CardHeader>
					<CardContent className="p-0">
						<ConfigRow label="Duration threshold" value={`≥ ${String(status.alertDurationMs)} ms`} mono />
						<ConfigRow label="Dedupe window" value={`${String(status.alertWindowMinutes)} minutes`} mono />
						<ConfigRow label="Webhook" value={status.alertWebhookUrl ?? "Not configured (storage only)"} mono />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
