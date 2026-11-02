"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { FlushCacheSchema, PERMISSION, type CacheNamespaceSummary, type CacheOverview, type FlushCacheInput } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Progress } from "@workspace/ui/components/progress";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

import { formatBytes } from "../lib/ops-format";

/** How often the numbers refresh while the page is open. */
const CACHE_REFRESH_MS = 15_000;
const PERCENT = 100;
const MS_PER_SECOND = 1000;

/** A hit ratio as people read it ("94%"), or a dash before the first read. */
export function formatHitRatio(ratio: number | null): string {
	return ratio === null ? "—" : `${String(Math.round(ratio * PERCENT))}%`;
}

/** A TTL in the largest whole unit ("5 min", "30 s", "2 h"). */
export function formatTtl(ttlMs: number): string {
	const seconds = Math.round(ttlMs / MS_PER_SECOND);
	const SECONDS_PER_HOUR = 3600;
	const SECONDS_PER_MINUTE = 60;
	if (seconds % SECONDS_PER_HOUR === 0) {
		return `${String(seconds / SECONDS_PER_HOUR)} h`;
	}
	if (seconds % SECONDS_PER_MINUTE === 0) {
		return `${String(seconds / SECONDS_PER_MINUTE)} min`;
	}
	return `${String(seconds)} s`;
}

/** `/operations/cache` (ADR 072): each cache's hit ratio and size, Redis memory, and flushing a cache or a tenant. */
export function CacheView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const cacheQuery = api.operations.cache.useQuery(undefined, { refetchInterval: CACHE_REFRESH_MS });
	const overview = cacheQuery.data?.data;
	const canFlush = can(PERMISSION.CACHE.DELETE);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Cache</h1>
				<p className="text-sm text-muted-foreground">Data that rarely changes is kept in memory and in Redis, so pages load without asking the database every time.</p>
			</header>
			{overview === undefined ? <Skeleton className="h-64 w-full rounded-xl" /> : <CacheOverviewCards overview={overview} canFlush={canFlush} />}
			{canFlush ? <FlushTenantCard /> : null}
		</div>
	);
}

function CacheOverviewCards({ overview, canFlush }: { readonly overview: CacheOverview; readonly canFlush: boolean }): React.JSX.Element {
	const redis = overview.redis;
	const usedPercent = redis?.maxBytes === null || redis === null ? null : Math.round((redis.usedBytes / redis.maxBytes) * PERCENT);
	return (
		<>
			{overview.circuitOpen ? (
				<Alert variant="warning">
					<AlertTitle>Redis is not answering</AlertTitle>
					<AlertDescription>Reads go straight to the database until it recovers. Pages may be slower.</AlertDescription>
				</Alert>
			) : null}
			{redis === null ? null : (
				<Card>
					<CardHeader>
						<CardTitle>Redis memory</CardTitle>
						<CardDescription>
							Shared with the job queues, so it must never evict (policy <span className="font-mono">{redis.policy}</span>).
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<span className="tabular-nums">
								{formatBytes(redis.usedBytes)}
								{redis.maxBytes === null ? " used (no limit set)" : ` of ${formatBytes(redis.maxBytes)}`}
							</span>
							<StatusBadge tone={redis.policyOk ? "success" : "danger"}>{redis.policyOk ? "No eviction" : "Evicting — fix maxmemory-policy"}</StatusBadge>
						</div>
						{usedPercent === null ? null : <Progress value={usedPercent} aria-label="Redis memory used" />}
						{usedPercent !== null && usedPercent >= redis.alertPercent ? <p className="text-sm text-destructive">Above the {redis.alertPercent}% alert line.</p> : null}
					</CardContent>
				</Card>
			)}
			<Card>
				<CardHeader>
					<CardTitle>Caches</CardTitle>
					<CardDescription>Counts since the API last started. Flushing a cache makes the next read rebuild it.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Cache</TableHead>
								<TableHead>Kept</TableHead>
								<TableHead>For</TableHead>
								<TableHead className="text-end">Hit ratio</TableHead>
								<TableHead className="text-end">Entries</TableHead>
								<TableHead className="text-end">Failures</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{overview.namespaces.map((namespace): React.JSX.Element => (
								<NamespaceRow key={namespace.name} namespace={namespace} canFlush={canFlush} />
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</>
	);
}

function useFlush(): { readonly flush: (input: FlushCacheInput) => void; readonly isPending: boolean } {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const mutation = api.operations.flushCache.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Cache flushed", description: "The next read rebuilds it." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.cache.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not flush the cache", error);
		},
	});
	const { mutate } = mutation;
	const flush = React.useCallback(
		(input: FlushCacheInput): void => {
			mutate(input);
		},
		[mutate],
	);
	return { flush, isPending: mutation.isPending };
}

/** Flushing from the table is audited with this reason. */
const NAMESPACE_FLUSH_REASON = "Flushed from the cache page to rebuild it";

function NamespaceRow({ namespace, canFlush }: { readonly namespace: CacheNamespaceSummary; readonly canFlush: boolean }): React.JSX.Element {
	const { flush, isPending } = useFlush();
	const handleFlush = React.useCallback((): void => {
		flush({ target: "namespace", name: namespace.name, reason: NAMESPACE_FLUSH_REASON });
	}, [flush, namespace.name]);
	return (
		<TableRow>
			<TableCell>
				<span className="font-medium">{namespace.name}</span>
				<span className="ms-2 text-xs text-muted-foreground">v{namespace.version}</span>
				{namespace.encrypted ? <span className="ms-2 text-xs text-muted-foreground">encrypted</span> : null}
			</TableCell>
			<TableCell>
				{namespace.tier} · per {namespace.scope}
			</TableCell>
			<TableCell>{formatTtl(namespace.ttlMs)}</TableCell>
			<TableCell className="text-end tabular-nums">{formatHitRatio(namespace.hitRatio)}</TableCell>
			<TableCell className="text-end tabular-nums">
				{namespace.localEntries}
				{namespace.sharedKeys === null ? "" : ` / ${String(namespace.sharedKeys)}`}
			</TableCell>
			<TableCell className="text-end tabular-nums">{namespace.loadFailures + namespace.refusedWrites}</TableCell>
			<TableCell className="text-end">
				{canFlush ? (
					<Button type="button" size="sm" variant="outline" onClick={handleFlush} disabled={isPending}>
						Flush
					</Button>
				) : null}
			</TableCell>
		</TableRow>
	);
}

/** Drop everything cached for one tenant (after a manual data fix), with the reason kept in the audit log. */
function FlushTenantCard(): React.JSX.Element {
	const { flush, isPending } = useFlush();
	const [tenantId, setTenantId] = React.useState("");
	const [reason, setReason] = React.useState("");
	const parsed = FlushCacheSchema.safeParse({ target: "tenant", tenantId: tenantId.trim(), reason });
	const handleTenant = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTenantId(event.currentTarget.value);
	}, []);
	const handleReason = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReason(event.currentTarget.value);
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			flush({ target: "tenant", tenantId: tenantId.trim(), reason });
		},
		[flush, reason, tenantId],
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Flush one tenant</CardTitle>
				<CardDescription>Every cached entry of one tenant, in every cache.</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end" aria-label="Flush one tenant">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="flush-tenant">Tenant ID</Label>
						<Input id="flush-tenant" value={tenantId} onChange={handleTenant} />
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="flush-reason">Why (at least 10 characters)</Label>
						<Input id="flush-reason" value={reason} onChange={handleReason} placeholder="e.g. Fixed the store's address by hand" />
					</div>
					<Button type="submit" disabled={!parsed.success || isPending}>
						Flush tenant
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
